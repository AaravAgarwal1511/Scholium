import { useNavigate } from "react-router-dom";
import { AuthCard } from "@repo/ui";
import { useAnalytics } from "@repo/analytics";
import { supabase } from "@/integrations/supabase/client";

interface LoginProps {
  defaultMode?: "signin" | "signup";
}

export default function Login({ defaultMode = "signin" }: LoginProps) {
  const navigate = useNavigate();
  const { track } = useAnalytics();

  async function handleSignIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    track("sign_in");
    navigate("/");
    return null;
  }

  async function handleSignUp(email: string, password: string): Promise<string | null> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
    track("sign_up");
    if (data.session) navigate("/");
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
      onSignIn={handleSignIn}
      onSignUp={handleSignUp}
      onForgotPassword={handleForgotPassword}
    />
  );
}
