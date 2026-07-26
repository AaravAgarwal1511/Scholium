import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { SingleSessionGuard } from './SingleSessionGuard';

/**
 * The guard kicks a second device off a shared account. The Supabase client is a
 * prop, so a fake covers the whole surface; these tests never touch a network.
 *
 * Two rules carry the weight, both learned the hard way and documented in the
 * component:
 *   - sessions are scoped per app_key, because the suite's apps are separate
 *     origins — using two apps at once must NOT self-kick;
 *   - the realtime subscription uses NO server-side filter, because a
 *     `user_id=eq.` filter silently drops UPDATE events under the table's default
 *     replica identity. Delivery is scoped by RLS and re-checked by app_key.
 */

interface UpsertCall {
    row: { user_id: string; app_key: string; session_token: string; updated_at: string };
    options: unknown;
}
type ChangeHandler = (payload: { new?: { app_key?: string; session_token?: string } }) => void;

/**
 * A stand-in Supabase client. `reconcileToken` is what the select() reports back
 * as the slot's current owner; `emit()` fires a realtime event at the subscribed
 * handler, as another device claiming the slot would.
 */
function makeFakeSupabase(reconcileToken: string | null = null) {
    const upserts: UpsertCall[] = [];
    const channelSubscribeSpy = vi.fn();
    const removeChannelSpy = vi.fn();
    const signOutSpy = vi.fn().mockResolvedValue({ error: null });
    let changeHandler: ChangeHandler | null = null;
    let subscribedFilter: unknown = null;
    // Order log, to prove subscribe happens before reconcile (the race window).
    const order: string[] = [];

    const channel = {
        on(_event: string, filter: unknown, handler: ChangeHandler) {
            subscribedFilter = filter;
            changeHandler = handler;
            return channel;
        },
        subscribe() {
            order.push('subscribe');
            channelSubscribeSpy();
            return channel;
        },
    };

    const supabase = {
        from() {
            return {
                upsert(row: UpsertCall['row'], options: unknown) {
                    upserts.push({ row, options });
                    return Promise.resolve({ data: null, error: null });
                },
                select() {
                    return this;
                },
                eq() {
                    return this;
                },
                maybeSingle() {
                    order.push('reconcile');
                    return Promise.resolve({
                        data: reconcileToken ? { session_token: reconcileToken } : null,
                        error: null,
                    });
                },
            };
        },
        channel() {
            return channel;
        },
        removeChannel: removeChannelSpy,
        auth: { signOut: signOutSpy },
    };

    return {
        supabase,
        upserts,
        signOutSpy,
        removeChannelSpy,
        channelSubscribeSpy,
        order,
        emit: (payload: Parameters<ChangeHandler>[0]) => changeHandler?.(payload),
        get subscribedFilter() {
            return subscribedFilter;
        },
    };
}

beforeEach(() => {
    localStorage.clear();
    cleanup();
    vi.restoreAllMocks();
    // A fixed device id makes "same device" vs "other device" explicit.
    localStorage.setItem('scholium-device-id', 'THIS-DEVICE');
});

describe('claiming the slot', () => {
    it('does nothing at all while signed out', async () => {
        const fake = makeFakeSupabase();
        render(<SingleSessionGuard supabase={fake.supabase} userId={null} appKey="recall" />);
        await new Promise((r) => setTimeout(r, 20));
        expect(fake.upserts).toHaveLength(0);
        expect(fake.channelSubscribeSpy).not.toHaveBeenCalled();
    });

    it('upserts this device into the (user, app) slot when signed in', async () => {
        const fake = makeFakeSupabase();
        render(<SingleSessionGuard supabase={fake.supabase} userId="user-1" appKey="recall" />);

        await waitFor(() => expect(fake.upserts).toHaveLength(1));
        expect(fake.upserts[0].row).toMatchObject({
            user_id: 'user-1',
            app_key: 'recall',
            session_token: 'THIS-DEVICE',
        });
        expect(fake.upserts[0].options).toEqual({ onConflict: 'user_id,app_key' });
    });

    it('subscribes before it reconciles, closing the claim/subscribe race', async () => {
        const fake = makeFakeSupabase('THIS-DEVICE');
        render(<SingleSessionGuard supabase={fake.supabase} userId="user-1" appKey="recall" />);
        await waitFor(() => expect(fake.order).toContain('reconcile'));
        expect(fake.order.indexOf('subscribe')).toBeLessThan(fake.order.indexOf('reconcile'));
    });

    it('subscribes with no server-side row filter', async () => {
        // A `filter: 'user_id=eq...'` here would drop UPDATE events under the
        // default replica identity. The subscription must be scoped only by
        // table/event, with RLS + the app_key re-check doing the narrowing.
        const fake = makeFakeSupabase('THIS-DEVICE');
        render(<SingleSessionGuard supabase={fake.supabase} userId="user-1" appKey="recall" />);
        await waitFor(() => expect(fake.channelSubscribeSpy).toHaveBeenCalled());
        expect(fake.subscribedFilter).not.toHaveProperty('filter');
        expect(fake.subscribedFilter).toMatchObject({ table: 'active_sessions', event: '*' });
    });
});

describe('kicking', () => {
    it('stays silent when this device already owns the slot', async () => {
        const fake = makeFakeSupabase('THIS-DEVICE');
        render(<SingleSessionGuard supabase={fake.supabase} userId="user-1" appKey="recall" />);
        await waitFor(() => expect(fake.channelSubscribeSpy).toHaveBeenCalled());
        await new Promise((r) => setTimeout(r, 10));
        expect(screen.queryByRole('alertdialog')).toBeNull();
        expect(fake.signOutSpy).not.toHaveBeenCalled();
    });

    it('kicks when reconcile finds another device holding the slot', async () => {
        const fake = makeFakeSupabase('OTHER-DEVICE');
        render(<SingleSessionGuard supabase={fake.supabase} userId="user-1" appKey="recall" />);
        // getByRole throws when absent, so reaching past waitFor means it appeared.
        await waitFor(() => screen.getByRole('alertdialog'));
        expect(screen.getByText('Signed out')).toBeTruthy();
    });

    it('signs out local scope only, never the winning device', async () => {
        const fake = makeFakeSupabase('OTHER-DEVICE');
        render(<SingleSessionGuard supabase={fake.supabase} userId="user-1" appKey="recall" />);
        await waitFor(() => expect(fake.signOutSpy).toHaveBeenCalled());
        expect(fake.signOutSpy).toHaveBeenCalledWith({ scope: 'local' });
    });

    it('kicks on a realtime event for this app carrying a different token', async () => {
        const fake = makeFakeSupabase('THIS-DEVICE'); // reconcile is clean
        render(<SingleSessionGuard supabase={fake.supabase} userId="user-1" appKey="recall" />);
        await waitFor(() => expect(fake.channelSubscribeSpy).toHaveBeenCalled());

        fake.emit({ new: { app_key: 'recall', session_token: 'OTHER-DEVICE' } });
        await waitFor(() => screen.getByRole('alertdialog'));
    });

    it('ignores a realtime event for a DIFFERENT app — using two apps must not self-kick', async () => {
        const fake = makeFakeSupabase('THIS-DEVICE');
        render(<SingleSessionGuard supabase={fake.supabase} userId="user-1" appKey="recall" />);
        await waitFor(() => expect(fake.channelSubscribeSpy).toHaveBeenCalled());

        // Same user signing into language-hub on this very device claims the
        // language-hub slot; recall's guard must not react to it.
        fake.emit({ new: { app_key: 'language-hub', session_token: 'OTHER-DEVICE' } });
        await new Promise((r) => setTimeout(r, 20));
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });

    it('ignores a realtime event that echoes this device back', async () => {
        const fake = makeFakeSupabase('THIS-DEVICE');
        render(<SingleSessionGuard supabase={fake.supabase} userId="user-1" appKey="recall" />);
        await waitFor(() => expect(fake.channelSubscribeSpy).toHaveBeenCalled());

        fake.emit({ new: { app_key: 'recall', session_token: 'THIS-DEVICE' } });
        await new Promise((r) => setTimeout(r, 20));
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });
});

describe('lifecycle', () => {
    it('removes the channel on unmount', async () => {
        const fake = makeFakeSupabase('THIS-DEVICE');
        const { unmount } = render(
            <SingleSessionGuard supabase={fake.supabase} userId="user-1" appKey="recall" />,
        );
        await waitFor(() => expect(fake.channelSubscribeSpy).toHaveBeenCalled());
        unmount();
        expect(fake.removeChannelSpy).toHaveBeenCalled();
    });

    it('does not kick after unmount even if the reconcile resolves late', async () => {
        // The async closure checks a cancelled flag; unmounting mid-flight must
        // not pop the dialog on a torn-down tree.
        const fake = makeFakeSupabase('OTHER-DEVICE');
        const { unmount } = render(
            <SingleSessionGuard supabase={fake.supabase} userId="user-1" appKey="recall" />,
        );
        unmount();
        await new Promise((r) => setTimeout(r, 20));
        expect(screen.queryByRole('alertdialog')).toBeNull();
    });
});

describe('device id', () => {
    it('generates one and reuses it across mounts', async () => {
        localStorage.removeItem('scholium-device-id');
        const fake = makeFakeSupabase();
        render(<SingleSessionGuard supabase={fake.supabase} userId="user-1" appKey="recall" />);
        await waitFor(() => expect(fake.upserts).toHaveLength(1));

        const first = localStorage.getItem('scholium-device-id');
        expect(first).toBeTruthy();

        const fake2 = makeFakeSupabase();
        render(<SingleSessionGuard supabase={fake2.supabase} userId="user-2" appKey="language-hub" />);
        await waitFor(() => expect(fake2.upserts).toHaveLength(1));
        expect(fake2.upserts[0].row.session_token).toBe(first);
    });
});
