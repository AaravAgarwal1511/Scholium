import { useEffect, useState, lazy, Suspense } from "react";
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

// Settings/Auth/ResetPassword are reached from a click, never on first paint of
// the homepage, so their code doesn't need to ship in the bundle every visitor
// downloads — lazy-load them into their own chunks. GeneratePaperPage (the
// homepage almost every visit lands on) stays a static import.
const SettingsPage = lazy(() => import("@/pages/Settings"));
const Auth = lazy(() => import("@/pages/Auth"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));

function RouteFallback() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="h-12 rounded-lg bg-card animate-pulse" />
    </div>
  );
}

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
      <Suspense fallback={<RouteFallback />}>
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
      </Suspense>
      <ScholiumFooter homeUrl={SCHOLIUM_HOME_URL} />
      <Toaster />
    </>
  );
}
