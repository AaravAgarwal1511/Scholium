import { useNavigate } from "react-router-dom";
import { AuthCard } from "@repo/ui";
import "@repo/ui/auth-card.css";
import { supabase } from "@/integrations/supabase/client";

interface AuthProps {
  defaultMode?: "signin" | "signup";
}

export default function Auth({ defaultMode = "signin" }: AuthProps) {
  const navigate = useNavigate();

  async function handleSignIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    navigate("/");
    return null;
  }

  async function handleSignUp(email: string, password: string): Promise<string | null> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
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
      hint="Sign in to keep your mock attempts on this device."
      onSignIn={handleSignIn}
      onSignUp={handleSignUp}
      onForgotPassword={handleForgotPassword}
    />
  );
}
