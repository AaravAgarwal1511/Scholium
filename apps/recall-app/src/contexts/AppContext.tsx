import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { SingleSessionGuard } from "@repo/session";
import { AnalyticsProvider } from "@repo/analytics";
import { supabase } from "@/integrations/supabase/client";
import type { Passes, User } from "@/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

interface AppState {
  user: User | null;
  supabaseUser: SupabaseUser | null;
  passes: Passes;
  loadingAuth: boolean;
  loadingProgress: boolean;
  setPassForChapter: (chapterId: string, pass: number) => Promise<void>;
  resetProgress: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [supabaseUser, setSupabaseUser] = useState<SupabaseUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [passes, setPasses] = useState<Passes>({});
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(false);

  // ── Auth listener ──────────────────────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const sbUser = session?.user ?? null;
      setSupabaseUser(sbUser);
      if (sbUser) {
        const name = (sbUser.email ?? "")
          .split("@")[0]
          .replace(/[._]/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        setUser({ email: sbUser.email ?? "", name });
      } else {
        setUser(null);
        setPasses({});
      }
      setLoadingAuth(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Load progress whenever auth user changes ───────────────────────────────
  useEffect(() => {
    if (!supabaseUser) { setPasses({}); return; }
    setLoadingProgress(true);
    supabase
      .from("recall_progress")
      .select("chapter_id, pass")
      .eq("user_id", supabaseUser.id)
      .then(({ data }) => {
        if (data) {
          const p: Passes = {};
          for (const row of data) p[row.chapter_id] = row.pass;
          setPasses(p);
        }
        setLoadingProgress(false);
      })
      .catch(() => setLoadingProgress(false));
  }, [supabaseUser]);

  // ── Upsert a single chapter's pass ────────────────────────────────────────
  const setPassForChapter = useCallback(async (chapterId: string, pass: number) => {
    if (!supabaseUser) return;
    setPasses((prev) => ({ ...prev, [chapterId]: pass }));
    await supabase.from("recall_progress").upsert(
      { user_id: supabaseUser.id, chapter_id: chapterId, pass },
      { onConflict: "user_id,chapter_id" },
    );
  }, [supabaseUser]);

  // ── Reset all progress ─────────────────────────────────────────────────────
  const resetProgress = useCallback(async () => {
    if (!supabaseUser) return;
    setPasses({});
    await supabase.from("recall_progress").delete().eq("user_id", supabaseUser.id);
  }, [supabaseUser]);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const deleteAccount = useCallback(async () => {
    if (!supabaseUser) return;
    await supabase.from("recall_progress").delete().eq("user_id", supabaseUser.id);
    await supabase.auth.signOut();
  }, [supabaseUser]);

  const value = useMemo<AppState>(
    () => ({ user, supabaseUser, passes, loadingAuth, loadingProgress, setPassForChapter, resetProgress, logout, deleteAccount }),
    [user, supabaseUser, passes, loadingAuth, loadingProgress, setPassForChapter, resetProgress, logout, deleteAccount],
  );

  return (
    <AppContext.Provider value={value}>
      <SingleSessionGuard supabase={supabase} userId={supabaseUser?.id ?? null} appKey="recall-app" />
      <AnalyticsProvider
        supabase={supabase}
        supabaseUrl={SUPABASE_URL}
        supabaseAnonKey={SUPABASE_ANON_KEY}
        appKey="recall-app"
        userId={supabaseUser?.id ?? null}
      >
        {children}
      </AnalyticsProvider>
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
