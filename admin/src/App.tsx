import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import Stats from "./pages/Stats";
import Content from "./pages/Content";
import TwoSiders from "./pages/TwoSiders";
import Analytics from "./pages/Analytics";
import Blog from "./pages/Blog";
import Login from "./pages/Login";

type Tab = "stats" | "analytics" | "content" | "essays" | "blog";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("stats");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) =>
      setSession(s),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  if (loading)
    return <div className="p-10 text-slate-500">Loading…</div>;
  if (!session) return <Login />;

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <TabBtn active={tab === "stats"} onClick={() => setTab("stats")}>
              Stats
            </TabBtn>
            <TabBtn active={tab === "analytics"} onClick={() => setTab("analytics")}>
              Analytics
            </TabBtn>
            <TabBtn active={tab === "content"} onClick={() => setTab("content")}>
              Content
            </TabBtn>
            <TabBtn active={tab === "essays"} onClick={() => setTab("essays")}>
              Essays
            </TabBtn>
            <TabBtn active={tab === "blog"} onClick={() => setTab("blog")}>
              Blog
            </TabBtn>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </header>
      {tab === "stats" ? (
        <Stats />
      ) : tab === "analytics" ? (
        <Analytics />
      ) : tab === "content" ? (
        <Content />
      ) : tab === "blog" ? (
        <Blog />
      ) : (
        <TwoSiders />
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors " +
        (active
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100")
      }
    >
      {children}
    </button>
  );
}
