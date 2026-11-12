import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  ScholiumNavbar,
  TermsOfService,
  PrivacyPolicy,
  suiteAppLinks,
  suiteSubjectLinks,
  getSubjectByName,
  subjectUrl,
} from "@repo/ui";
import type { AppLink } from "@repo/ui";
import "@repo/ui/scholium-navbar.css";
import "@repo/ui/legal.css";
import { Analytics } from "@vercel/analytics/react";
import { usePageView, useAnalytics } from "@repo/analytics";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import HomePage from "@/pages/HomePage";
import ResetPassword from "@/pages/ResetPassword";
import Auth from "@/pages/Auth";
import MemorySciencePage from "@/pages/MemorySciencePage";
import AboutPage from "@/pages/AboutPage";
import SubjectPage from "@/pages/SubjectPage";
import ToolSubjectsPage from "@/pages/ToolSubjectsPage";
import HeroScenesPage from "@/dev/hero-scenes/HeroScenesPage";

// Subject-first prototype: the suite comes from the static registry in
// @repo/ui (SUITE_TOOLS / SUITE_SUBJECTS) instead of the scholium_apps table,
// so every app agrees on the same subjects and tools. A tool's url here is its
// subject list (/tools/:mount), not the tool itself.
async function loadScholiumApps(): Promise<AppLink[]> {
  return suiteAppLinks();
}

function NavbarWired({ apps }: { apps: AppLink[] }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { track } = useAnalytics();
  // On /physics the Physics entry in the Subjects dropdown is highlighted.
  const firstSegment = useLocation().pathname.split("/")[1] ?? "";
  return (
    <ScholiumNavbar
      apps={apps}
      subjects={suiteSubjectLinks()}
      currentSubject={firstSegment}
      onAppClick={(id) => track("nav_app_click", { to_app_id: id })}
      user={user ? { email: user.email ?? "" } : null}
      onSignOut={async () => {
        await signOut();
        navigate("/");
      }}
      onPickSubject={(subject) => {
        const s = getSubjectByName(subject);
        navigate(s ? subjectUrl(s.slug) : "/");
      }}
    />
  );
}

function RouteAnalytics() {
  usePageView(useLocation().pathname);
  return null;
}

export default function App() {
  const [apps, setApps] = useState<AppLink[]>([]);
  const [loadingApps, setLoadingApps] = useState(true);

  useEffect(() => {
    loadScholiumApps()
      .then(setApps)
      .finally(() => setLoadingApps(false));
  }, []);

  return (
    <AuthProvider>
      <Analytics />
      <BrowserRouter>
        <NavbarWired apps={apps} />
        <RouteAnalytics />
        <Routes>
          <Route path="/" element={<HomePage apps={apps} loadingApps={loadingApps} />} />
          <Route path="/signin" element={<Auth defaultMode="signin" />} />
          <Route path="/signup" element={<Auth defaultMode="signup" />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/memory-science" element={<MemorySciencePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          {import.meta.env.DEV && (
            <Route path="/__hero-scenes" element={<HeroScenesPage />} />
          )}
          <Route path="/tools/:mount" element={<ToolSubjectsPage />} />
          <Route
            path="/:subject"
            element={<SubjectPage fallback={<HomePage apps={apps} loadingApps={loadingApps} />} />}
          />
          <Route path="*" element={<HomePage apps={apps} loadingApps={loadingApps} />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
