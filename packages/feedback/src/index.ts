export { FeedbackProvider } from './FeedbackProvider';
export type { FeedbackProviderProps } from './FeedbackProvider';

export { useFeedback } from './useFeedback';
export type { FeedbackContextValue, OpenFeedbackOptions } from './useFeedback';

export { FeedbackFooter } from './FeedbackFooter';

export { ReportProblemButton } from './ReportProblemButton';
export type { ReportProblemButtonProps } from './ReportProblemButton';

// Framework-free pieces — exported mainly for tests.
export { PromptSchedule, PROMPT_DEFAULTS } from './schedule';
export type { PromptState, ScheduleOptions, StorageLike } from './schedule';
export { submitFeedback, toRpcArgs, RATE_LIMITED_MESSAGE, GENERIC_ERROR_MESSAGE } from './submit';
export type { FeedbackSource, SubmitContext, SupabaseRpcLike } from './submit';
