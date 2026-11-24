import { useState, type CSSProperties } from 'react';
import { FeedbackDialog, type FeedbackValues } from '@repo/ui';
import { submitFeedback, type SupabaseRpcLike } from './submit';
import { currentPath } from './browser';

export interface ReportProblemButtonProps {
  supabase: SupabaseRpcLike;
  appKey: string;
  appName?: string;
  appVersion?: string;
  /** The caught error; its message (not the stack) is prefilled for the user to review. */
  error?: Error | null;
  className?: string;
  style?: CSSProperties;
}

/** Self-contained "Report this problem" button + dialog for error boundaries.
 *  An app's ErrorBoundary sits ABOVE FeedbackProvider (and above the analytics
 *  and auth providers), and by the time it renders its fallback those providers
 *  are gone — so this needs no provider and talks to submitFeedback directly. */
export function ReportProblemButton({
  supabase,
  appKey,
  appName,
  appVersion,
  error,
  className,
  style,
}: ReportProblemButtonProps) {
  const [open, setOpen] = useState(false);
  const prefill = error?.message
    ? `What were you doing when this happened?\n\n\n---\nError: ${error.message.slice(0, 500)}`
    : '';

  const onSubmit = (values: FeedbackValues) =>
    submitFeedback(supabase, values, {
      appKey,
      source: 'error',
      path: currentPath(),
      appVersion,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    });

  return (
    <>
      <button type="button" className={className} style={style} onClick={() => setOpen(true)}>
        Report this problem
      </button>
      <FeedbackDialog
        open={open}
        onClose={() => setOpen(false)}
        onSubmit={onSubmit}
        initialCategory="bug"
        initialMessage={prefill}
        appName={appName}
      />
    </>
  );
}
