import { useEffect, useState } from "react";
import { BrowserRouter, Route, Routes, Navigate, useNavigate } from "react-router-dom";
import {
  ScholiumNavbar,
  ScholiumFooter,
  TermsOfService,
  PrivacyPolicy,
  SCHOLIUM_HOME_URL,
  useDarkMode,
} from "@repo/ui";
import type { AppLink } from "@repo/ui";
import "@repo/ui/scholium-navbar.css";
import "@repo/ui/legal.css";
import DesktopGuard from "@/components/DesktopGuard";
import { supabase } from "@/integrations/supabase/client";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AttemptProvider } from "@/contexts/AttemptContext";
import HomePage from "@/pages/HomePage";
import AttemptPage from "@/pages/AttemptPage";
import ExportPage from "@/pages/ExportPage";
import Demo from "@/pages/Demo";
import Auth from "@/pages/Auth";
import ResetPassword from "@/pages/ResetPassword";
import SettingsPage from "@/pages/Settings";

// This app's own row in scholium_apps. Ids are UUIDs (not slugs), so match by URL.
const OWN_APP_URL = "https://mock-space.vercel.app";

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
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  return (
    <ScholiumNavbar
      apps={apps}
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

  // Every other app gets the `dark` class for free because ScholiumNavbar calls
  // this hook and the navbar is always mounted. The workspace and the demo render
  // outside the navbar, so the root has to apply the theme itself.
  useDarkMode();

  useEffect(() => {
    loadScholiumApps().then(setApps);
  }, []);

  const ownDescription = apps.find((a) => a.url === OWN_APP_URL)?.description ?? null;

  return (
    <AuthProvider>
      <AttemptProvider>
        <BrowserRouter>
          <Routes>
            {/* The workspace fills the viewport and supplies its own chrome. */}
            <Route
              path="/attempt"
              element={
                <DesktopGuard>
                  <AttemptPage />
                </DesktopGuard>
              }
            />
            <Route path="/demo" element={<Demo />} />
            <Route path="*" element={<MainRoutes apps={apps} ownDescription={ownDescription} />} />
          </Routes>
        </BrowserRouter>
      </AttemptProvider>
    </AuthProvider>
  );
}

function MainRoutes({ apps, ownDescription }: { apps: AppLink[]; ownDescription: string | null }) {
  return (
    <div className="flex min-h-screen flex-col">
      <NavbarWired apps={apps} />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage description={ownDescription} />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/signin" element={<Auth defaultMode="signin" />} />
          <Route path="/signup" element={<Auth defaultMode="signup" />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/terms" element={<TermsOfService homeUrl={SCHOLIUM_HOME_URL} />} />
          <Route path="/privacy" element={<PrivacyPolicy homeUrl={SCHOLIUM_HOME_URL} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <ScholiumFooter homeUrl={SCHOLIUM_HOME_URL} />
    </div>
  );
}
