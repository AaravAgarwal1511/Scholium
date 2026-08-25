import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthCard } from "@repo/ui";
import { useAnalytics } from "@repo/analytics";
import { supabase } from "@/integrations/supabase/client";

interface AuthProps {
  defaultMode?: "signin" | "signup";
}

// Context-specific copy for the AuthCard `hint` slot, keyed by a fixed,
// whitelisted `hint` query param rather than rendering arbitrary URL text —
// same-origin only in practice (see `next` below), but there's no reason to
// trust free text from a query string when a closed set covers every caller.
const HINTS: Record<string, string> = {
  mock_space: "Sign in to open this paper in Mock Space.",
  history: "Sign in to keep every paper you generate.",
};

export default function Auth({ defaultMode = "signin" }: AuthProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { track } = useAnalytics();

  // Where to land after a successful sign-in/up. The only source of this
  // param is another in-app link (the navbar, or the Mock Space CTA), so it
  // is always a same-origin path — but a leading "//" still parses as a
  // protocol-relative URL, so it's rejected rather than trusted. Mirrors
  // mock-space's Auth.tsx, which solved this first.
  const rawNext = searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const hint = HINTS[searchParams.get("hint") ?? ""];

  useEffect(() => {
    track("signin_view", { mode: defaultMode, has_next: rawNext != null });
    // Fire once per mount only — these don't change without a remount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      track("sign_in_failed", { reason: error.message.slice(0, 64) });
      return error.message;
    }
    track("sign_in");
    navigate(next);
    return null;
  }

  async function handleSignUp(email: string, password: string): Promise<string | null> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      track("sign_up_failed", { reason: error.message.slice(0, 64) });
      return error.message;
    }
    track("sign_up");
    if (data.session) navigate(next);
    return null;
  }

  async function handleForgotPassword(email: string): Promise<string | null> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    return error ? error.message : null;
  }

  return (
    <AuthCard
      defaultMode={defaultMode}
      hint={hint}
      onSignIn={handleSignIn}
      onSignUp={handleSignUp}
      onForgotPassword={handleForgotPassword}
    />
  );
}
