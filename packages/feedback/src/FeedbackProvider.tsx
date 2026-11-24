import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  FeedbackDialog,
  FeedbackPrompt,
  type FeedbackCategory,
  type FeedbackPromptStatus,
  type FeedbackValues,
} from '@repo/ui';
import { useAnalytics } from '@repo/analytics';
import { FeedbackContext, type FeedbackContextValue, type OpenFeedbackOptions } from './useFeedback';
import { PromptSchedule, PROMPT_DEFAULTS, type ScheduleOptions } from './schedule';
import { submitFeedback, type FeedbackSource, type SupabaseRpcLike } from './submit';
import { safeStorage, currentPath } from './browser';

export interface FeedbackProviderProps {
  /** The app's Supabase client. Only rpc('submit_feedback') is used. */
  supabase: SupabaseRpcLike;
  /** Same key the app gives SingleSessionGuard / AnalyticsProvider. */
  appKey: string;
  /** Human name for copy, e.g. "Recall". */
  appName?: string;
  /** Build/version string, stored with each submission. */
  appVersion?: string;
  /** The periodic prompt never appears on a path starting with one of these
   *  (sign-in pages, exam attempts…). Matched against location.pathname. */
  suppressPromptOn?: string[];
  /** Turn the periodic prompt off entirely (the dialog still works). */
  promptEnabled?: boolean;
  /** Override the cadence — mainly for tests. */
  schedule?: ScheduleOptions & { dwellMs?: number };
  children: ReactNode;
}

interface DialogState {
  open: boolean;
  category: FeedbackCategory;
  rating: number | null;
  message: string;
  source: FeedbackSource;
}

const CLOSED: DialogState = { open: false, category: 'other', rating: null, message: '', source: 'form' };
const RECHECK_MS = 30_000;
const QUICK_THANKS_MS = 6_000;

/** Mounts the feedback dialog + periodic prompt for one app. Place it inside
 *  AnalyticsProvider so submissions are counted (count + category only — the
 *  free text never reaches analytics). */
export function FeedbackProvider({
  supabase,
  appKey,
  appName,
  appVersion,
  suppressPromptOn = [],
  promptEnabled = true,
  schedule: scheduleOpts,
  children,
}: FeedbackProviderProps) {
  const { track } = useAnalytics();
  const [dialog, setDialog] = useState<DialogState>(CLOSED);
  const [showPrompt, setShowPrompt] = useState(false);
  // The prompt's one-click rating, sent without opening the dialog.
  const [quick, setQuick] = useState<{ status: FeedbackPromptStatus; rating: number | null; error: string }>({
    status: 'idle',
    rating: null,
    error: '',
  });

  const schedule = useMemo(
    () =>
      new PromptSchedule({
        storage: safeStorage(() => localStorage),
        session: safeStorage(() => sessionStorage),
        options: scheduleOpts,
      }),
    // Options are static per app mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Keep the latest suppress list in a ref so the timer reads it without re-arming.
  const suppressRef = useRef(suppressPromptOn);
  useEffect(() => {
    suppressRef.current = suppressPromptOn;
  }, [suppressPromptOn]);

  const dialogOpenRef = useRef(false);
  useEffect(() => {
    dialogOpenRef.current = dialog.open;
  }, [dialog.open]);

  // Count the visit, then after the dwell time show the prompt if it's due and the
  // current page allows it. `?feedbackPrompt=1` forces it (manual QA).
  useEffect(() => {
    if (!promptEnabled || typeof window === 'undefined') return;
    schedule.recordVisit();

    let forced = false;
    try {
      forced = new URLSearchParams(window.location.search).get('feedbackPrompt') === '1';
    } catch {
      forced = false;
    }

    const blocked = () => {
      const path = currentPath();
      return dialogOpenRef.current || suppressRef.current.some((p) => path === p || path.startsWith(p.endsWith('/') ? p : `${p}/`));
    };

    let timer: ReturnType<typeof setTimeout> | undefined;
    const attempt = () => {
      if (!forced && !schedule.isDue()) return; // not due this visit; stop checking
      if (blocked()) {
        timer = setTimeout(attempt, RECHECK_MS);
        return;
      }
      schedule.markShown();
      setShowPrompt(true);
      track('feedback_prompt_shown');
    };
    timer = setTimeout(attempt, forced ? 500 : (scheduleOpts?.dwellMs ?? PROMPT_DEFAULTS.dwellMs));
    return () => clearTimeout(timer);
    // Armed once per app mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptEnabled, schedule]);

  const open = useCallback((o: OpenFeedbackOptions = {}) => {
    setShowPrompt(false);
    setDialog({
      open: true,
      category: o.category ?? 'other',
      rating: o.rating ?? null,
      message: o.message ?? '',
      source: o.source ?? 'form',
    });
  }, []);

  const close = useCallback(() => setDialog((d) => ({ ...d, open: false })), []);

  const send = useCallback(
    async (values: FeedbackValues, source: FeedbackSource) => {
      await submitFeedback(supabase, values, {
        appKey,
        source,
        path: currentPath(),
        appVersion,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      });
      schedule.markSubmitted();
      track('feedback_submitted', {
        category: values.category,
        rating: values.rating ?? 0,
        source,
        has_message: values.message.length > 0,
      });
    },
    [supabase, appKey, appVersion, schedule, track],
  );

  const handleSubmit = useCallback(
    (values: FeedbackValues) => send(values, dialog.source),
    [send, dialog.source],
  );

  // One click on a prompt star sends just the rating — no form.
  const rateFromPrompt = useCallback(
    async (rating: number) => {
      setQuick({ status: 'sending', rating, error: '' });
      try {
        await send({ category: 'other', rating, message: '', website: '' }, 'prompt');
        setQuick({ status: 'sent', rating, error: '' });
      } catch (err) {
        setQuick({ status: 'error', rating: null, error: err instanceof Error ? err.message : '' });
      }
    },
    [send],
  );

  // After a quick rating, let the thank-you linger briefly, then get out of the way.
  useEffect(() => {
    if (quick.status !== 'sent') return;
    const t = setTimeout(() => setShowPrompt(false), QUICK_THANKS_MS);
    return () => clearTimeout(t);
  }, [quick.status]);

  const value = useMemo<FeedbackContextValue>(() => ({ open }), [open]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {showPrompt && !dialog.open ? (
        <FeedbackPrompt
          appName={appName}
          status={quick.status}
          rating={quick.rating}
          errorMessage={quick.error}
          onRate={rateFromPrompt}
          // The rating (if any) is already saved, so "Tell us more" opens a blank form.
          onOpenForm={() => open({ source: 'prompt' })}
          onDismiss={() => {
            setShowPrompt(false);
            track('feedback_prompt_dismissed');
          }}
        />
      ) : null}
      <FeedbackDialog
        open={dialog.open}
        onClose={close}
        onSubmit={handleSubmit}
        initialCategory={dialog.category}
        initialRating={dialog.rating}
        initialMessage={dialog.message}
        appName={appName}
      />
    </FeedbackContext.Provider>
  );
}
