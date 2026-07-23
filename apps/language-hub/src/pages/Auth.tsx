import { useNavigate } from "react-router-dom";
import { AuthCard } from "@repo/ui";
import { useAnalytics } from "@repo/analytics";
import { supabase } from "@/integrations/supabase/client";

interface AuthProps {
    defaultMode?: "signin" | "signup";
}

const Auth = ({ defaultMode = "signin" }: AuthProps) => {
    const navigate = useNavigate();
    const { track } = useAnalytics();

    async function handleSignIn(email: string, password: string): Promise<string | null> {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) return error.message;
        track("sign_in");
        navigate("/");
        return null;
    }

    async function handleSignUp(email: string, password: string): Promise<string | null> {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) return error.message;
        track("sign_up");
        if (data.session) navigate("/");
        return null;
    }

    async function handleForgotPassword(email: string): Promise<string | null> {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
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
};

export default Auth;
