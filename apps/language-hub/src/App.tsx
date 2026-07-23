import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ScholiumNavbar, ScholiumFooter, TermsOfService, PrivacyPolicy, SCHOLIUM_HOME_URL } from "@repo/ui";
import type { AppLink } from "@repo/ui";
import "@repo/ui/scholium-navbar.css";
import "@repo/ui/legal.css";
import { supabase } from "@/integrations/supabase/client";
import { Analytics } from "@vercel/analytics/react";
import { usePageView, useAnalytics } from "@repo/analytics";
import Index from "./pages/Index";
import Demo from "./pages/Demo";
import CreateSet from "./pages/CreateSet";
import Study from "./pages/Study";
import FirstPass from "./pages/FirstPass";
import Practice from "./pages/Practice";
import PracticeSetup from "./pages/PracticeSetup";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import EditSet from "./pages/EditSet";
import Folder from "./pages/Folder";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// This app's own row in scholium_apps. Ids are UUIDs (not slugs), so match by URL.
const OWN_APP_URL = "https://language-flash-hub.vercel.app";

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

function NavbarWired({ apps }: { apps: AppLink[] }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { track } = useAnalytics();
  return (
    <ScholiumNavbar
      apps={apps}
      onAppClick={(id) => track("nav_app_click", { to_app_id: id })}
      homeUrl={SCHOLIUM_HOME_URL}
      user={user ? { email: user.email ?? "" } : null}
      onSignIn={() => navigate("/signin")}
      onSignUp={() => navigate("/signup")}
      onSignOut={signOut}
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
        <Route path="/" element={<Index description={description} />} />
        <Route path="/create" element={<CreateSet />} />
        <Route path="/edit/:id" element={<EditSet />} />
        <Route path="/folder/:id" element={<Folder />} />
        <Route path="/study/:id" element={<Study />} />
        <Route path="/first-pass/:id" element={<FirstPass />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/practice-setup" element={<PracticeSetup />} />
        <Route path="/signin" element={<Auth defaultMode="signin" />} />
        <Route path="/signup" element={<Auth defaultMode="signup" />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/terms" element={<TermsOfService homeUrl={SCHOLIUM_HOME_URL} />} />
        <Route path="/privacy" element={<PrivacyPolicy homeUrl={SCHOLIUM_HOME_URL} />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

const App = () => {
  const [apps, setApps] = useState<AppLink[]>([]);

  useEffect(() => {
    loadScholiumApps().then(setApps);
  }, []);

  const ownDescription = apps.find((a) => a.url === OWN_APP_URL)?.description ?? null;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Analytics />
        <BrowserRouter>
          <Routes>
            <Route path="/demo" element={<Demo />} />
            <Route
              path="*"
              element={
                <AuthProvider>
                  <NavbarWired apps={apps} />
                  <FadeRoutes description={ownDescription} />
                  <ScholiumFooter homeUrl={SCHOLIUM_HOME_URL} />
                </AuthProvider>
              }
            />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
