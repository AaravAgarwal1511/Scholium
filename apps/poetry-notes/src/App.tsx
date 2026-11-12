import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ProjectProvider, useProject } from './contexts/ProjectContext';
import {
  ScholiumNavbar,
  ScholiumFooter,
  TermsOfService,
  PrivacyPolicy,
  SuiteSubjectBar,
  suiteAppLinks,
  suiteSubjectLinks,
  goToSubjectByName,
} from '@repo/ui';
import { SCOPE } from './suiteScope';
import type { AppLink } from '@repo/ui';
import '@repo/ui/scholium-navbar.css';
import '@repo/ui/legal.css';
import { Analytics } from '@vercel/analytics/react';
import { usePageView, useAnalytics } from '@repo/analytics';
import { Login } from './pages/Login';
import { Settings } from './pages/Settings';
import { LandingPage } from './components/LandingPage';
import { MainLayout } from './components/Layout/MainLayout';
import { ResetPasswordView } from './components/ResetPasswordView';
import Demo from './pages/Demo';
import './App.css';

// This app's own row in scholium_apps. Ids are UUIDs (not slugs), so match by URL.
const OWN_APP_URL = 'https://poetrynotes.vercel.app';

// Suite mode: the navbar's tools come from the shared registry in @repo/ui.
async function loadScholiumApps(): Promise<AppLink[]> {
  return suiteAppLinks();
}

type View = 'landing' | 'editor' | 'settings';

function AppContent() {
  const { user, loadingAuth, isPasswordRecovery, signOut } = useAuth();
  const { setUserId, saveToCloud } = useProject();
  const [currentView, setCurrentView] = useState<View>('landing');
  usePageView('/' + currentView);
  const { track } = useAnalytics();
  const [apps, setApps] = useState<AppLink[]>([]);

  useEffect(() => {
    setUserId(user?.id ?? null);
  }, [user, setUserId]);

  useEffect(() => {
    loadScholiumApps().then(setApps);
  }, []);

  if (loadingAuth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: '2rem' }}>📝</span>
      </div>
    );
  }

  if (isPasswordRecovery) return <ResetPasswordView />;
  if (!user) return <Login />;

  const handleProjectReady = () => setCurrentView('editor');

  const handleBackToLanding = async () => {
    await saveToCloud();
    setCurrentView('landing');
  };

  const handleSignOut = async () => {
    await saveToCloud();
    await signOut();
    setCurrentView('landing');
  };

  const ownDescription = apps.find((a) => a.url === OWN_APP_URL)?.description ?? null;

  return (
    <div className="app">
      <ScholiumNavbar
        apps={apps}
        onAppClick={(id) => track('nav_app_click', { to_app_id: id })}
        homeUrl=""
        currentAppId={SCOPE?.tool.id}
        subjects={suiteSubjectLinks()}
        currentSubject={SCOPE?.subject.slug}
        onPickSubject={(subject) => goToSubjectByName(subject)}
        user={user ? { email: user.email ?? '' } : null}
        onSignOut={handleSignOut}
        onSettings={() => setCurrentView('settings')}
      />
      {SCOPE && <SuiteSubjectBar subject={SCOPE.subject} currentToolId={SCOPE.tool.id} />}
      <div key={currentView} className="page-fade-in">
        {currentView === 'settings' ? (
          <Settings onBack={() => setCurrentView('landing')} onSignOut={handleSignOut} />
        ) : currentView === 'editor' ? (
          <MainLayout onBackToLanding={handleBackToLanding} />
        ) : (
          <LandingPage
            onProjectReady={handleProjectReady}
            onSettings={() => setCurrentView('settings')}
            description={ownDescription}
          />
        )}
      </div>
      <ScholiumFooter homeUrl="" />
    </div>
  );
}

export default function App() {
  // The /demo and legal pages are public and router-free — served directly. Compute
  // the page rather than returning early so a single <Analytics /> mounts on every
  // path (Vercel Web Analytics must see the demo and legal pageviews too).
  // Suite mode: paths are relative to /:subject/poetry-notes.
  if (!SCOPE) return null;
  const full = typeof window !== 'undefined' ? window.location.pathname : '';
  const path = full.slice(SCOPE.basename.length) || '/';
  const routerFreePage =
    path === '/demo' ? <Demo /> :
    path === '/terms' ? <TermsOfService homeUrl="" /> :
    path === '/privacy' ? <PrivacyPolicy homeUrl="" /> :
    null;
  return (
    <>
      <Analytics />
      {routerFreePage ?? (
        <AuthProvider>
          <ProjectProvider>
            <AppContent />
          </ProjectProvider>
        </AuthProvider>
      )}
    </>
  );
}
