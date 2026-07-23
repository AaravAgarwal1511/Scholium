import { createContext, useContext } from 'react';

export type TrackFn = (name: string, props?: Record<string, unknown>, path?: string) => void;

export interface AnalyticsContextValue {
  track: TrackFn;
  /** Persist the user's opt-out choice (default on → false). */
  setOptOut: (optedOut: boolean) => void;
}

const noop: AnalyticsContextValue = { track: () => {}, setOptOut: () => {} };

export const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

/** Returns a no-op when no provider is mounted, so Storybook stories, unit tests,
 *  and the router-free `/demo` trees never crash on `useAnalytics()`. */
export function useAnalytics(): AnalyticsContextValue {
  return useContext(AnalyticsContext) ?? noop;
}
