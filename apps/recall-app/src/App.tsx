import { useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppProvider, useApp } from "@/contexts/AppContext";
import { Toaster } from "@/components/ui/sonner";
import { ScholiumNavbar, ScholiumFooter, TermsOfService, PrivacyPolicy, SCHOLIUM_HOME_URL } from "@repo/ui";
import type { AppLink } from "@repo/ui";
import "@repo/ui/scholium-navbar.css";
import "@repo/ui/legal.css";
import { supabase } from "@/integrations/supabase/client";
import { Analytics } from "@vercel/analytics/react";
import { usePageView, useAnalytics } from "@repo/analytics";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import Demo from "@/pages/Demo";
import Study from "@/pages/Study";
import TwoSider from "@/pages/TwoSider";
import PracticeSection from "@/pages/PracticeSection";
import Settings from "@/pages/Settings";
import ResetPassword from "@/pages/ResetPassword";

// This app's own row in scholium_apps. Ids are UUIDs (not slugs), so match by URL.
const OWN_APP_URL = "https://recall-master-app.vercel.app";

async function loadScholiumApps(): Promise<AppLink[]> {
  const first = await supabase
    .from("scholium_apps")
    .select("id, title, url, icon, subjects, description, has_demo, no_login")
    .order("sort_order");
  if (first.error && /(subjects|description|has_demo|no_login)/i.test(first.error.message)) {
    const fallback = await supabase
      .from("scholium_apps")
      .select("id, title, url, icon")
      .order("sort_order");
    return (fallback.data ?? []) as AppLink[];
  }
  return (first.data ?? []) as AppLink[];
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loadingAuth } = useApp();
  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }
  if (!user) return <Navigate to="/signin" replace />;
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, loadingAuth } = useApp();
  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function NavbarWired({ apps }: { apps: AppLink[] }) {
  const { supabaseUser, logout } = useApp();
  const navigate = useNavigate();
  const { track } = useAnalytics();
  return (
    <ScholiumNavbar
      apps={apps}
      onAppClick={(id) => track("nav_app_click", { to_app_id: id })}
      homeUrl={SCHOLIUM_HOME_URL}
      user={supabaseUser ? { email: supabaseUser.email ?? "" } : null}
      onSignIn={() => navigate("/signin")}
      onSignUp={() => navigate("/signup")}
      onSignOut={async () => {
        await logout();
        navigate("/signin");
      }}
      onSettings={() => navigate("/settings")}
    />
  );
}

function FadeRoutes({ description }: { description?: string | null }) {
  const location = useLocation();
  usePageView(location.pathname);
  return (
    <div key={location.key} className="page-fade-in">
      <Routes>
        <Route
          path="/signin"
          element={
            <RedirectIfAuthed>
              <Login defaultMode="signin" />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/signup"
          element={
            <RedirectIfAuthed>
              <Login defaultMode="signup" />
            </RedirectIfAuthed>
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Home description={description} />
            </RequireAuth>
          }
        />
        <Route
          path="/study/:id"
          element={
            <RequireAuth>
              <Study />
            </RequireAuth>
          }
        />
        <Route
          path="/two-sider/:id"
          element={
            <RequireAuth>
              <TwoSider />
            </RequireAuth>
          }
        />
        <Route
          path="/practice-section/:sectionId"
          element={
            <RequireAuth>
              <PracticeSection />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <Settings />
            </RequireAuth>
          }
        />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/terms" element={<TermsOfService homeUrl={SCHOLIUM_HOME_URL} />} />
        <Route path="/privacy" element={<PrivacyPolicy homeUrl={SCHOLIUM_HOME_URL} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  const [apps, setApps] = useState<AppLink[]>([]);

  useEffect(() => {
    loadScholiumApps().then(setApps);
  }, []);

  const ownDescription = apps.find((a) => a.url === OWN_APP_URL)?.description ?? null;

  return (
    <BrowserRouter>
      <Analytics />
      <Routes>
        <Route path="/demo" element={<Demo />} />
        <Route
          path="*"
          element={
            <AppProvider>
              <NavbarWired apps={apps} />
              <FadeRoutes description={ownDescription} />
              <ScholiumFooter homeUrl={SCHOLIUM_HOME_URL} />
              <Toaster />
            </AppProvider>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
