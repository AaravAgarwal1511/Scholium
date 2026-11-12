import { lazy, Suspense, useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import {
  ScholiumNavbar,
  ScholiumFooter,
  TermsOfService,
  PrivacyPolicy,
  SuiteSubjectBar,
  suiteAppLinks,
  suiteSubjectLinks,
  goToSubjectByName,
} from "@repo/ui";
import { SCOPE } from "@/suiteScope";
import type { AppLink } from "@repo/ui";
import "@repo/ui/scholium-navbar.css";
import "@repo/ui/legal.css";
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

// The starter-sets catalog pulls in ~3,000 vocabulary items across its per-set
// JSON chunks; keep it and its data off the initial bundle.
const StarterSets = lazy(() => import("./pages/StarterSets"));

const queryClient = new QueryClient();

// This app's own row in scholium_apps. Ids are UUIDs (not slugs), so match by URL.
const OWN_APP_URL = "https://language-flash-hub.vercel.app";

// Suite mode: the navbar's tools come from the shared registry in @repo/ui.
async function loadScholiumApps(): Promise<AppLink[]> {
  return suiteAppLinks();
}

function NavbarWired({ apps }: { apps: AppLink[] }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { track } = useAnalytics();
  return (
    <ScholiumNavbar
      apps={apps}
      onAppClick={(id) => track("nav_app_click", { to_app_id: id })}
      homeUrl=""
      currentAppId={SCOPE?.tool.id}
      subjects={suiteSubjectLinks()}
      currentSubject={SCOPE?.subject.slug}
      onPickSubject={(subject) => goToSubjectByName(subject)}
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
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Index description={description} />} />
          <Route path="/create" element={<CreateSet />} />
          <Route path="/starter-sets" element={<StarterSets />} />
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
          <Route path="/terms" element={<TermsOfService homeUrl="" />} />
          <Route path="/privacy" element={<PrivacyPolicy homeUrl="" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  );
}

const App = () => {
  const [apps, setApps] = useState<AppLink[]>([]);

  useEffect(() => {
    loadScholiumApps().then(setApps);
  }, []);

  const ownDescription = apps.find((a) => a.url === OWN_APP_URL)?.description ?? null;

  if (!SCOPE) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Analytics />
        <BrowserRouter basename={SCOPE.basename}>
          <Routes>
            <Route path="/demo" element={<Demo />} />
            <Route
              path="*"
              element={
                <AuthProvider>
                  <NavbarWired apps={apps} />
                  <SuiteSubjectBar subject={SCOPE.subject} currentToolId={SCOPE.tool.id} />
                  <FadeRoutes description={ownDescription} />
                  <ScholiumFooter homeUrl="" />
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
