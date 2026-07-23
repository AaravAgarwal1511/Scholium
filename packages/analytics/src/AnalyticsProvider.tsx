import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { AnalyticsContext, type AnalyticsContextValue } from './useAnalytics';
import { Tracker, type QueuedEvent, type StorageLike } from './core';

// Structural stand-in for the app's Supabase client — same rationale as
// @repo/session's SingleSessionGuard: typing it properly would drag in
// @supabase/supabase-js, and the typed clients in language-hub/recall-app would
// then resolve `.from("analytics_events")` against a table missing from their
// generated types and emit a SelectQueryError. `any` here sidesteps all of that;
// we only need insert() and the current access token.
/* eslint-disable @typescript-eslint/no-explicit-any */
interface SupabaseLike {
  from: (table: string) => any;
  auth: {
    getSession: () => Promise<{ data: { session: { access_token?: string } | null } }>;
    onAuthStateChange: (
      cb: (event: string, session: { access_token?: string } | null) => void,
    ) => { data: { subscription: { unsubscribe: () => void } } };
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface AnalyticsProviderProps {
  /** The app's Supabase client (for the normal insert path + the access token). */
  supabase: SupabaseLike;
  /** From the app's own env — this package stays env-free. Used by the keepalive path. */
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** Stable per-app key, e.g. "recall-app". Same value the app gives SingleSessionGuard. */
  appKey: string;
  /** Current signed-in user id, or null. Attributed to each event; RLS checks it == auth.uid(). */
  userId: string | null;
  /** Override the master switch; defaults to PROD && VITE_ANALYTICS_ENABLED === 'true'. */
  enabled?: boolean;
  children: ReactNode;
}

const FLUSH_INTERVAL_MS = 10_000;

// import.meta.env is Vite-injected in the apps; guard for non-Vite contexts.
function viteEnv(): Record<string, unknown> {
  return (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};
}
function envEnabled(): boolean {
  const env = viteEnv();
  return env.PROD === true && env.VITE_ANALYTICS_ENABLED === 'true';
}
// Phase-3 verification against production: stamp every event so the debug rows can
// be found and deleted afterward (see reports/ANALYTICS_PLAN.md §8).
function envDebug(): boolean {
  return viteEnv().VITE_ANALYTICS_DEBUG === 'true';
}

export function AnalyticsProvider({
  supabase,
  supabaseUrl,
  supabaseAnonKey,
  appKey,
  userId,
  enabled,
  children,
}: AnalyticsProviderProps) {
  // Latest access token, cached so the unload path can attach it synchronously.
  const tokenRef = useRef<string | null>(null);

  const tracker = useMemo(() => {
    const browserDoNotTrack =
      typeof navigator !== 'undefined' &&
      ((navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl === true ||
        navigator.doNotTrack === '1');

    // Normal (non-unload) path only: let supabase-js attach the auth header.
    // insert() with no .select() returns minimal, so the absent SELECT policy is
    // never hit. The unload path is handled separately, below, so this closure
    // needs no access token and therefore no ref read during render.
    const send = (rows: QueuedEvent[]): void => {
      try {
        void Promise.resolve(supabase.from('analytics_events').insert(rows)).catch(() => {});
      } catch {
        // ignore — analytics must never throw
      }
    };

    return new Tracker({
      appKey,
      storage: safeStorage(() => localStorage),
      session: safeStorage(() => sessionStorage),
      enabled: enabled ?? envEnabled(),
      browserDoNotTrack,
      send,
      baseProps: envDebug() ? { debug: true } : undefined,
    });
    // Created once per app mount; supabase is a module singleton, so only
    // appKey/enabled identity matters and those are constant for an app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appKey, enabled]);

  // Cache the access token for the keepalive path (can't await on unload).
  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (active) tokenRef.current = data.session?.access_token ?? null;
      })
      .catch(() => {});
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      tokenRef.current = session?.access_token ?? null;
      // Only SIGNED_OUT is emitted automatically: it fires exactly once on a real
      // sign-out. SIGNED_IN is deliberately NOT auto-tracked — supabase-js re-fires
      // it on tab refocus/token refresh, so sign_in/sign_up are explicit per-app
      // calls at the auth-success moment instead.
      if (event === 'SIGNED_OUT') tracker.track('sign_out');
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [supabase, tracker]);

  // Keep the tracker's attributed user in sync.
  useEffect(() => {
    tracker.identify(userId);
  }, [tracker, userId]);

  // One `app_open` per app load. track() no-ops when analytics is disabled.
  useEffect(() => {
    tracker.track('app_open');
  }, [tracker]);

  // Periodic flush + flush-on-hide. The most valuable events (study_complete,
  // attempt_submit) often fire right as the tab is hidden or the page unloads.
  useEffect(() => {
    // Unload path: supabase-js insert uses fetch WITHOUT keepalive and is dropped
    // when the page is unloading, so drain the queue and POST to PostgREST directly
    // with keepalive. Reading tokenRef here is legal — it runs in an event handler,
    // not during render. Signed-out events (user_id null) go under the anon key; a
    // signed-in event needs the bearer token so auth.uid() matches user_id.
    const beacon = () => {
      const rows = tracker.drain();
      if (rows.length === 0) return;
      try {
        const token = tokenRef.current ?? supabaseAnonKey;
        void fetch(`${supabaseUrl}/rest/v1/analytics_events`, {
          method: 'POST',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${token}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(rows),
        }).catch(() => {});
      } catch {
        // ignore — analytics must never throw
      }
    };

    const interval = setInterval(() => {
      void tracker.flush();
    }, FLUSH_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') beacon();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', beacon);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', beacon);
      void tracker.flush();
    };
  }, [tracker, supabaseUrl, supabaseAnonKey]);

  const value = useMemo<AnalyticsContextValue>(
    () => ({
      track: (name, props, path) => tracker.track(name, props, path),
      setOptOut: (optedOut) => tracker.setOptOut(optedOut),
    }),
    [tracker],
  );

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

/** Probe Web Storage; fall back to an in-memory shim in private mode / when
 *  storage is disabled, so tracking never throws on construction. */
function safeStorage(get: () => Storage): StorageLike {
  try {
    const s = get();
    const probe = '__scholium_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    const m = new Map<string, string>();
    return {
      getItem: (k) => m.get(k) ?? null,
      setItem: (k, v) => {
        m.set(k, v);
      },
      removeItem: (k) => {
        m.delete(k);
      },
    };
  }
}
