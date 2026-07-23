import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, Navigate, useLocation, useNavigate } from "react-router-dom";
import { ScholiumNavbar, ScholiumFooter, TermsOfService, PrivacyPolicy, SCHOLIUM_HOME_URL } from "@repo/ui";
import type { AppLink } from "@repo/ui";
import "@repo/ui/scholium-navbar.css";
import "@repo/ui/legal.css";
import { supabase } from "@/integrations/supabase/client";
import { Analytics } from "@vercel/analytics/react";
import { usePageView, useAnalytics } from "@repo/analytics";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import SubjectsPage from "@/pages/SubjectsPage";
import Demo from "@/pages/Demo";
import ComponentsPage from "@/pages/ComponentsPage";
import ChaptersPage from "@/pages/ChaptersPage";
import GeneratePaperPage from "@/pages/GeneratePaperPage";
import SettingsPage from "@/pages/Settings";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";

// This app's own row in scholium_apps. Ids are UUIDs (not slugs), so match by URL.
const OWN_APP_URL = "https://past-papers-app.vercel.app";

async function loadScholiumApps(): Promise<AppLink[]> {
  const first = await supabase
    .from("scholium_apps")
    .select("id, title, url, icon, subjects, description")
    .order("sort_order");
  if (first.error && /(subjects|description)/i.test(first.error.message)) {
    const fallback = await supabase
      .from("scholium_apps")
      .select("id, title, url, icon")
      .order("sort_order");
    return (fallback.data ?? []) as AppLink[];
  }
  return (first.data ?? []) as AppLink[];
}

function NavbarWired({ apps }: { apps: AppLink[] }) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { track } = useAnalytics();
  return (
    <ScholiumNavbar
      apps={apps}
      onAppClick={(id) => track("nav_app_click", { to_app_id: id })}
      homeUrl={SCHOLIUM_HOME_URL}
      user={user ? { email: user.email ?? "" } : null}
      onSignIn={() => navigate("/signin")}
      onSignUp={() => navigate("/signup")}
      onSignOut={async () => {
        await signOut();
        navigate("/");
      }}
      onSettings={() => navigate("/settings")}
    />
  );
}

export default function App() {
  const [apps, setApps] = useState<AppLink[]>([]);

  useEffect(() => {
    loadScholiumApps().then(setApps);
  }, []);

  const ownDescription = apps.find((a) => a.url === OWN_APP_URL)?.description ?? null;

  return (
    <AuthProvider>
      <Analytics />
      <BrowserRouter>
        <Routes>
          <Route path="/demo" element={<Demo />} />
          <Route path="*" element={<MainRoutes apps={apps} ownDescription={ownDescription} />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function MainRoutes({ apps, ownDescription }: { apps: AppLink[]; ownDescription: string | null }) {
  usePageView(useLocation().pathname);
  return (
    <>
      <NavbarWired apps={apps} />
      <Routes>
        <Route path="/" element={<SubjectsPage description={ownDescription} />} />
        <Route path="/signin" element={<Auth defaultMode="signin" />} />
        <Route path="/signup" element={<Auth defaultMode="signup" />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/generate" element={<GeneratePaperPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/terms" element={<TermsOfService homeUrl={SCHOLIUM_HOME_URL} />} />
        <Route path="/privacy" element={<PrivacyPolicy homeUrl={SCHOLIUM_HOME_URL} />} />
        <Route path="/:subject" element={<ComponentsPage />} />
        <Route path="/:subject/:component" element={<ChaptersPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ScholiumFooter homeUrl={SCHOLIUM_HOME_URL} />
    </>
  );
}
