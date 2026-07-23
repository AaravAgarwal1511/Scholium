import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { SingleSessionGuard } from "@repo/session";
import { AnalyticsProvider } from "@repo/analytics";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const isRecovery = useRef(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession()
            .then(({ data: { session } }) => {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
            })
            .catch(() => setLoading(false));

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);

                // Flag password recovery so the redirect logic sends them to the reset page
                if (_event === 'PASSWORD_RECOVERY') {
                    isRecovery.current = true;
                }
            }
        );

        return () => subscription.unsubscribe();
    }, []);

    // Redirect logic
    useEffect(() => {
        if (!loading) {
            // If a password recovery event was detected, send to reset page
            if (isRecovery.current) {
                isRecovery.current = false;
                navigate('/auth/reset-password');
                return;
            }

            const authPaths = ["/signin", "/signup"];
            const onAuthPage = authPaths.includes(location.pathname) || location.pathname.startsWith("/auth/");
            if (!user && !onAuthPage) {
                navigate("/signin");
            } else if (user && authPaths.includes(location.pathname)) {
                navigate("/");
            }
            // Note: authenticated users on /auth/reset-password are NOT redirected
        }
    }, [loading, user, location.pathname, navigate]);

    const signOut = async () => {
        await supabase.auth.signOut();
        navigate("/signin");
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, signOut }}>
            <SingleSessionGuard supabase={supabase} userId={user?.id ?? null} appKey="language-hub" />
            <AnalyticsProvider
                supabase={supabase}
                supabaseUrl={SUPABASE_URL}
                supabaseAnonKey={SUPABASE_ANON_KEY}
                appKey="language-hub"
                userId={user?.id ?? null}
            >
                {children}
            </AnalyticsProvider>
        </AuthContext.Provider>
    );
};
