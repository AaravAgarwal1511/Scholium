import { useEffect, useState, lazy, Suspense } from "react";
import type { ReactNode } from "react";
import {
  BrowserRouter,
  Route,
  Routes,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Loader2 } from "lucide-react";
import {
  ScholiumNavbar,
  ScholiumFooter,
  TermsOfService,
  PrivacyPolicy,
  SCHOLIUM_HOME_URL,
} from "@repo/ui";
import type { AppLink } from "@repo/ui";
import "@repo/ui/scholium-navbar.css";
import "@repo/ui/legal.css";
import { supabase } from "@/integrations/supabase/client";
import { Analytics } from "@vercel/analytics/react";
import { usePageView, useAnalytics } from "@repo/analytics";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import NotesListPage from "@/pages/NotesListPage";
import NoteViewerPage from "@/pages/NoteViewerPage";

// Reached from a click, never on the first paint of the list — split into their
// own chunks.
const SettingsPage = lazy(() => import("@/pages/Settings"));
const Auth = lazy(() => import("@/pages/Auth"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const NotFound = lazy(() => import("@/pages/NotFound"));

// This app's own row in scholium_apps, matched by URL (ids may be slugs or
// UUIDs in prod, but the url is canonical). Must stay byte-equal to that row's
// `url` or the homepage subtitle silently falls back to its default.
const OWN_APP_URL = "https://notes.thescholium.com";

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-primary" size={32} />
    </div>
  );
}

function RouteFallback() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="h-12 rounded-lg bg-card animate-pulse" />
    </div>
  );
}

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

// Every content route is gated — unlike mock-space / past-papers, there is
// nothing here to use signed out. The redirect is a convenience; the private
// bucket's RLS policy is what actually protects the PDFs.
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loadingAuth } = useAuth();
  const location = useLocation();
  if (loadingAuth) return <Spinner />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/signin?next=${next}`} replace />;
  }
  return <>{children}</>;
}

function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, loadingAuth } = useAuth();
  if (loadingAuth) return <Spinner />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function NavbarWired({ apps }: { apps: AppLink[] }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { track } = useAnalytics();
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

function MainRoutes({
  apps,
  ownDescription,
}: {
  apps: AppLink[];
  ownDescription: string | null;
}) {
  usePageView(useLocation().pathname);
  return (
    <>
      <NavbarWired apps={apps} />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route
            path="/"
            element={
              <RequireAuth>
                <NotesListPage description={ownDescription} />
              </RequireAuth>
            }
          />
          <Route
            path="/notes/:fileName"
            element={
              <RequireAuth>
                <NoteViewerPage />
              </RequireAuth>
            }
          />
          <Route
            path="/signin"
            element={
              <RedirectIfAuthed>
                <Auth defaultMode="signin" />
              </RedirectIfAuthed>
            }
          />
          <Route
            path="/signup"
            element={
              <RedirectIfAuthed>
                <Auth defaultMode="signup" />
              </RedirectIfAuthed>
            }
          />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route
            path="/settings"
            element={
              <RequireAuth>
                <SettingsPage />
              </RequireAuth>
            }
          />
          <Route path="/terms" element={<TermsOfService homeUrl={SCHOLIUM_HOME_URL} />} />
          <Route path="/privacy" element={<PrivacyPolicy homeUrl={SCHOLIUM_HOME_URL} />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      <ScholiumFooter homeUrl={SCHOLIUM_HOME_URL} />
    </>
  );
}
