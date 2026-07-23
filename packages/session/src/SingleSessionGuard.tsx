import { useEffect, useRef, useState, type CSSProperties } from 'react';

/**
 * Concurrent-session kicking — prevents account sharing.
 *
 * Each browser holds a stable per-origin device id. When a user is signed in,
 * this device "claims" the active-session slot for (user_id, app_key) by
 * upserting its id, then subscribes to Supabase Realtime on that row. If another
 * device claims the slot, the stored token changes and this device signs itself
 * out and shows a notice.
 *
 * Sessions are scoped per app_key because the suite's apps live on separate
 * origins (separate auth sessions + localStorage). A user using two apps at once
 * must NOT kick themselves — only a second device on the *same* app should.
 *
 * The Supabase client is passed in (rather than imported) so this package stays
 * free of a direct @supabase/supabase-js dependency.
 */

// These stay `any`. A structural stand-in cannot accept a real SupabaseClient:
// `from()` returns a deeply-generic PostgrestQueryBuilder that trips TS2589
// ("type instantiation is excessively deep") when structurally compared, and
// `channel().on()` is overloaded (presence | broadcast | postgres_changes) so
// assignability resolves against the first overload and always fails. Typing
// them properly means importing @supabase/supabase-js — see the note above.
/* eslint-disable @typescript-eslint/no-explicit-any */
interface SupabaseLike {
  from: (table: string) => any;
  channel: (name: string) => any;
  removeChannel: (channel: any) => any;
  auth: { signOut: (options?: { scope?: 'global' | 'local' | 'others' }) => Promise<unknown> };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface SingleSessionGuardProps {
  /** The app's Supabase client. */
  supabase: SupabaseLike;
  /** Current signed-in user id, or null when signed out. */
  userId: string | null;
  /** Stable per-app identifier, e.g. "language-hub". Scopes the session slot. */
  appKey: string;
}

const DEVICE_KEY = 'scholium-device-id';

function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    // Private mode / storage disabled — fall back to a per-load id.
    return `ephemeral-${Math.random().toString(36).slice(2)}`;
  }
}

export function SingleSessionGuard({ supabase, userId, appKey }: SingleSessionGuardProps) {
  const [kicked, setKicked] = useState(false);
  // Ref mirror so the async subscribe closure never re-kicks after unmount.
  const kickedRef = useRef(false);
  const claimedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId || kickedRef.current) return;

    const deviceId = getDeviceId();
    let cancelled = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see SupabaseLike
    let channel: any;

    const kick = () => {
      if (cancelled || kickedRef.current) return;
      kickedRef.current = true;
      setKicked(true);
      // Local scope only: clear *this* browser's session, never the winner's.
      supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    };

    const run = async () => {
      // Claim the slot once per user (idempotent for this browser — re-claiming
      // the same device id never kicks anyone, so auth refreshes are harmless).
      if (claimedForRef.current !== userId) {
        claimedForRef.current = userId;
        try {
          await supabase.from('active_sessions').upsert(
            {
              user_id: userId,
              app_key: appKey,
              session_token: deviceId,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,app_key' },
          );
        } catch {
          // Network/RLS failure shouldn't lock the user out of the app.
        }
      }
      if (cancelled) return;

      // Subscribe first, then reconcile — closes the race where another device
      // claims the slot in the window between our upsert and our subscription.
      //
      // No server-side `filter` on purpose: the RLS SELECT policy already scopes
      // delivery to this user's own rows, and a `user_id=eq.` filter silently
      // drops UPDATE events under the table's default replica identity. The
      // handler filters by app_key instead (a user has one row per app).
      channel = supabase
        .channel(`active-session:${appKey}:${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'active_sessions',
          },
          (payload: { new?: { app_key?: string; session_token?: string } }) => {
            const row = payload.new;
            if (row?.app_key === appKey && row.session_token && row.session_token !== deviceId) {
              kick();
            }
          },
        )
        .subscribe();

      try {
        const { data } = await supabase
          .from('active_sessions')
          .select('session_token')
          .eq('user_id', userId)
          .eq('app_key', appKey)
          .maybeSingle();
        if (data?.session_token && data.session_token !== deviceId) kick();
      } catch {
        // ignore reconcile failure
      }
    };

    run();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, userId, appKey]);

  if (!kicked) return null;

  return (
    <div style={overlayStyle} role="alertdialog" aria-modal="true" aria-labelledby="scholium-kicked-title">
      <div style={cardStyle}>
        <div style={{ fontSize: 32, lineHeight: 1 }} aria-hidden>🔒</div>
        <h2 id="scholium-kicked-title" style={titleStyle}>
          Signed out
        </h2>
        <p style={bodyStyle}>
          Your account was just signed in on another device. For security, each account can only be
          used in one place at a time.
        </p>
        <button type="button" style={buttonStyle} onClick={() => window.location.reload()}>
          Sign in again
        </button>
      </div>
    </div>
  );
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 2147483000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  background: 'rgba(0, 0, 0, 0.6)',
  backdropFilter: 'blur(4px)',
};

const cardStyle: CSSProperties = {
  maxWidth: 380,
  width: '100%',
  textAlign: 'center',
  background: 'hsl(var(--card, 0 0% 100%))',
  color: 'hsl(var(--card-foreground, 0 0% 6%))',
  border: '1px solid hsl(var(--border, 0 0% 90%))',
  borderRadius: 'var(--radius, 0.5rem)',
  boxShadow: '0 10px 40px rgba(0, 0, 0, 0.25)',
  padding: '32px 28px',
  fontFamily: 'inherit',
};

const titleStyle: CSSProperties = {
  margin: '16px 0 8px',
  fontSize: 20,
  fontWeight: 700,
};

const bodyStyle: CSSProperties = {
  margin: '0 0 24px',
  fontSize: 15,
  lineHeight: 1.5,
  color: 'hsl(var(--muted-foreground, 0 0% 40%))',
};

const buttonStyle: CSSProperties = {
  cursor: 'pointer',
  border: 'none',
  borderRadius: 'var(--radius, 0.5rem)',
  padding: '10px 24px',
  fontSize: 15,
  fontWeight: 600,
  fontFamily: 'inherit',
  background: 'hsl(var(--primary, 243 75% 59%))',
  color: 'hsl(var(--primary-foreground, 0 0% 100%))',
};
