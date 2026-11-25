import type { FeedbackValues } from '@repo/ui';

export type FeedbackSource = 'form' | 'prompt' | 'error';

/** Structural stand-in for the app's Supabase client (same rationale as
 *  @repo/analytics: typing it would drag in @supabase/supabase-js and fight each
 *  app's generated Database types). Only rpc() is needed. It is typed loosely on
 *  purpose: language-hub's and recall-app's generated types don't know
 *  submit_feedback yet, so their rpc() only accepts the function names they do
 *  know, and a `(fn: string) => …` signature would reject those clients. */
export interface SupabaseRpcLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (...args: any[]) => any;
}

export interface SubmitContext {
  appKey: string;
  source: FeedbackSource;
  path?: string;
  appVersion?: string;
  userAgent?: string;
}

export const RATE_LIMITED_MESSAGE =
  "You've sent a lot of feedback recently — thank you! Please try again in an hour.";
export const GENERIC_ERROR_MESSAGE = "Couldn't send your feedback. Check your connection and try again.";

/** Build the RPC arguments. Exported for tests. */
export function toRpcArgs(values: FeedbackValues, ctx: SubmitContext): Record<string, unknown> {
  return {
    p_app_key: ctx.appKey,
    p_category: values.category,
    p_message: values.message.trim() || null,
    p_rating: values.rating,
    p_source: ctx.source,
    p_path: ctx.path ? ctx.path.slice(0, 300) : null,
    p_app_version: ctx.appVersion ? ctx.appVersion.slice(0, 40) : null,
    p_user_agent: ctx.userAgent ? ctx.userAgent.slice(0, 300) : null,
    p_website: values.website || null,
  };
}

/** Calls submit_feedback. Throws an Error whose message is safe to show the user. */
export async function submitFeedback(
  supabase: SupabaseRpcLike,
  values: FeedbackValues,
  ctx: SubmitContext,
): Promise<void> {
  let result: { error?: { message?: string; code?: string } | null } | undefined;
  try {
    result = await supabase.rpc('submit_feedback', toRpcArgs(values, ctx));
  } catch {
    throw new Error(GENERIC_ERROR_MESSAGE);
  }
  const err = result?.error;
  if (!err) return;
  if (err.code === 'P0429' || /rate limited/i.test(err.message ?? '')) {
    throw new Error(RATE_LIMITED_MESSAGE);
  }
  throw new Error(GENERIC_ERROR_MESSAGE);
}
