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
import { Toaster } from "@/components/ui/sonner";
import GeneratePaperPage from "@/pages/GeneratePaperPage";
import SettingsPage from "@/pages/Settings";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";

// This app's own row in scholium_apps. Ids are UUIDs (not slugs), so match by URL
// — which means this must stay byte-equal to that row's `url`. The row moved to
// the custom domain while this still said past-papers-app.vercel.app, so the
// lookup silently missed and the subtitle fell back to its hardcoded default.
const OWN_APP_URL = "https://pastpapers.thescholium.com";

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
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { track } = useAnalytics();
  // Return here after signing in — matters beyond "/" since /settings is also
  // reachable while signed out. See Auth.tsx's `next` handling.
  const next = encodeURIComponent(location.pathname + location.search);
  return (
    <ScholiumNavbar
      apps={apps}
      onAppClick={(id) => track("nav_app_click", { to_app_id: id })}
      homeUrl={SCHOLIUM_HOME_URL}
      user={user ? { email: user.email ?? "" } : null}
      onSignInClick={() => track("signin_click", { source: "navbar" })}
      onSignUpClick={() => track("signup_click", { source: "navbar" })}
      onSignIn={() => navigate(`/signin?next=${next}`)}
      onSignUp={() => navigate(`/signup?next=${next}`)}
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
        <MainRoutes apps={apps} ownDescription={ownDescription} />
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
        <Route path="/" element={<GeneratePaperPage description={ownDescription} />} />
        <Route path="/generate" element={<Navigate to="/" replace />} />
        <Route path="/signin" element={<Auth defaultMode="signin" />} />
        <Route path="/signup" element={<Auth defaultMode="signup" />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/terms" element={<TermsOfService homeUrl={SCHOLIUM_HOME_URL} />} />
        <Route path="/privacy" element={<PrivacyPolicy homeUrl={SCHOLIUM_HOME_URL} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <ScholiumFooter homeUrl={SCHOLIUM_HOME_URL} />
      <Toaster />
    </>
  );
}
