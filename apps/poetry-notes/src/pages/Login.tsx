import { AuthCard } from '@repo/ui';
import { useAnalytics } from '@repo/analytics';
import { supabase } from '../integrations/supabase/client';

export function Login() {
  const { track } = useAnalytics();
  async function handleSignIn(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    track('sign_in');
    return null;
  }

  async function handleSignUp(email: string, password: string): Promise<string | null> {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) return error.message;
    track('sign_up');
    return null;
  }

  async function handleForgotPassword(email: string): Promise<string | null> {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return error ? error.message : null;
  }

  return (
    <AuthCard
      onSignIn={handleSignIn}
      onSignUp={handleSignUp}
      onForgotPassword={handleForgotPassword}
    />
  );
}
