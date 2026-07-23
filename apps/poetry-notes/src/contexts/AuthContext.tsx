import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { SingleSessionGuard } from '@repo/session';
import { AnalyticsProvider } from '@repo/analytics';
import { supabase } from '../integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface AuthContextType {
  user: User | null;
  loadingAuth: boolean;
  isPasswordRecovery: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data }) => {
        setUser(data.session?.user ?? null);
        setLoadingAuth(false);
      })
      .catch(() => setLoadingAuth(false));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
      if (event === 'USER_UPDATED') setIsPasswordRecovery(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, loadingAuth, isPasswordRecovery, signOut }}>
      <SingleSessionGuard supabase={supabase} userId={user?.id ?? null} appKey="poetry-notes" />
      <AnalyticsProvider
        supabase={supabase}
        supabaseUrl={SUPABASE_URL}
        supabaseAnonKey={SUPABASE_ANON_KEY}
        appKey="poetry-notes"
        userId={user?.id ?? null}
      >
        {children}
      </AnalyticsProvider>
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
