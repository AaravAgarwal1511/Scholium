import { useNavigate, useSearchParams } from "react-router-dom";
import { AuthCard } from "@repo/ui";
import "@repo/ui/auth-card.css";
import { useAnalytics } from "@repo/analytics";
import { supabase } from "@/integrations/supabase/client";

interface AuthProps {
  defaultMode?: "signin" | "signup";
}

export default function Auth({ defaultMode = "signin" }: AuthProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { track } = useAnalytics();

  // Where to land after a successful sign-in/up. The only source of this param
  // is another in-app page linking to /signin?next=... (see OpenPaperPage), so
  // it is always a same-origin path — but a leading "//" is still parsed as a
  // protocol-relative URL by the browser, so it's rejected rather than trusted.
  const rawNext = searchParams.get("next");
  const next = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  async function handleSignIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    track("sign_in");
    navigate(next);
    return null;
  }

  async function handleSignUp(email: string, password: string): Promise<string | null> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
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
      hint="Sign in to keep your mock attempts on this device."
      onSignIn={handleSignIn}
      onSignUp={handleSignUp}
      onForgotPassword={handleForgotPassword}
    />
  );
}
