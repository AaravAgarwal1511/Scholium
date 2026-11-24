import { createContext, useContext } from 'react';
import type { FeedbackCategory } from '@repo/ui';
import type { FeedbackSource } from './submit';

export interface OpenFeedbackOptions {
  category?: FeedbackCategory;
  rating?: number | null;
  message?: string;
  source?: FeedbackSource;
}

export interface FeedbackContextValue {
  /** Open the feedback dialog, optionally prefilled. */
  open: (options?: OpenFeedbackOptions) => void;
}

const noop: FeedbackContextValue = { open: () => {} };

export const FeedbackContext = createContext<FeedbackContextValue | null>(null);

/** No-op without a provider, so stories, unit tests and error fallbacks rendered
 *  outside the provider never crash. */
export function useFeedback(): FeedbackContextValue {
  return useContext(FeedbackContext) ?? noop;
}
