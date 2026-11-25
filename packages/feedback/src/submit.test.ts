import { describe, it, expect, vi } from 'vitest';
import { submitFeedback, toRpcArgs, RATE_LIMITED_MESSAGE, GENERIC_ERROR_MESSAGE } from './submit';

const values = { category: 'idea' as const, rating: 4, message: '  more subjects  ', website: '' };
const ctx = { appKey: 'recall-app', source: 'prompt' as const, path: '/study', appVersion: '1.2.3', userAgent: 'UA' };

describe('toRpcArgs', () => {
  it('maps values and context to the RPC parameters', () => {
    expect(toRpcArgs(values, ctx)).toEqual({
      p_app_key: 'recall-app',
      p_category: 'idea',
      p_message: 'more subjects',
      p_rating: 4,
      p_source: 'prompt',
      p_path: '/study',
      p_app_version: '1.2.3',
      p_user_agent: 'UA',
      p_website: null,
    });
  });

  it('sends null for an empty message and truncates long context', () => {
    const args = toRpcArgs(
      { ...values, message: '   ' },
      { ...ctx, userAgent: 'u'.repeat(500), path: undefined },
    );
    expect(args.p_message).toBeNull();
    expect(args.p_path).toBeNull();
    expect((args.p_user_agent as string).length).toBe(300);
  });

  it('passes the honeypot through so the server can drop the row', () => {
    expect(toRpcArgs({ ...values, website: 'spam.biz' }, ctx).p_website).toBe('spam.biz');
  });
});

describe('submitFeedback', () => {
  it('calls submit_feedback and resolves on success', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await expect(submitFeedback({ rpc }, values, ctx)).resolves.toBeUndefined();
    expect(rpc).toHaveBeenCalledWith('submit_feedback', expect.objectContaining({ p_app_key: 'recall-app' }));
  });

  it('turns the rate limit into a friendly message', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { code: 'P0429', message: 'rate limited' } });
    await expect(submitFeedback({ rpc }, values, ctx)).rejects.toThrow(RATE_LIMITED_MESSAGE);
  });

  it('hides server error details from the user', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: { code: '22023', message: 'invalid category' } });
    await expect(submitFeedback({ rpc }, values, ctx)).rejects.toThrow(GENERIC_ERROR_MESSAGE);
  });

  it('handles a network failure', async () => {
    const rpc = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(submitFeedback({ rpc }, values, ctx)).rejects.toThrow(GENERIC_ERROR_MESSAGE);
  });
});
