import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, useNavigate } from "react-router-dom";
import { ScholiumNavbar, TermsOfService, PrivacyPolicy } from "@repo/ui";
import type { AppLink } from "@repo/ui";
import "@repo/ui/scholium-navbar.css";
import "@repo/ui/legal.css";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import HomePage from "@/pages/HomePage";
import ResetPassword from "@/pages/ResetPassword";
import Auth from "@/pages/Auth";
import MemorySciencePage from "@/pages/MemorySciencePage";
import AboutPage from "@/pages/AboutPage";
import HeroScenesPage from "@/dev/hero-scenes/HeroScenesPage";

// Source the suite — titles, icons, URLs, subject tags and descriptions — from
// the shared scholium_apps table (the same query the sibling apps use), so the
// subject chips reflect what each tool actually covers. Falls back to the base
// columns if an older DB lacks the subjects/description columns.
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
  return (
    <ScholiumNavbar
      apps={apps}
      user={user ? { email: user.email ?? "" } : null}
      onSignOut={async () => {
        await signOut();
        navigate("/");
      }}
      onPickSubject={(_subject, appId) =>
        navigate(`/?highlight=${encodeURIComponent(appId)}`)
      }
    />
  );
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
      <BrowserRouter>
        <NavbarWired apps={apps} />
        <Routes>
          <Route path="/" element={<HomePage apps={apps} loadingApps={loadingApps} />} />
          <Route path="/signin" element={<Auth defaultMode="signin" />} />
          <Route path="/signup" element={<Auth defaultMode="signup" />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/memory-science" element={<MemorySciencePage apps={apps} />} />
          <Route path="/about" element={<AboutPage apps={apps} />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          {import.meta.env.DEV && (
            <Route path="/__hero-scenes" element={<HeroScenesPage />} />
          )}
          <Route path="*" element={<HomePage apps={apps} loadingApps={loadingApps} />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
