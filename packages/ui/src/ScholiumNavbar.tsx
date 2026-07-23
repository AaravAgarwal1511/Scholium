import { useState, useRef, useEffect, useMemo } from 'react';
import { ScholiumLogo } from './ScholiumLogo';
import { useDarkMode } from '@repo/hooks';
import './ScholiumNavbar.css';

export interface AppLink {
  id: string;
  title: string;
  url: string;
  icon?: string | null;
  subjects?: string[] | null;
  description?: string | null;
  /** Tool offers a no-signup interactive trial at `<url>/demo`. */
  has_demo?: boolean | null;
  /** Tool itself can be used without an account. */
  no_login?: boolean | null;
}

export interface ScholiumNavbarProps {
  apps?: AppLink[];
  onSettings?: () => void;
  /** Base URL for the logo link and /signin /signup hrefs. Defaults to "" (relative). */
  homeUrl?: string;
  /** When provided, picking a search autocomplete suggestion calls this handler.
   *  When omitted, the navbar navigates to `${homeUrl}/?highlight=<appId>` instead.
   *  No `#tools` fragment: the home page scrolls to the matching card itself, and a
   *  fragment would race that smooth scroll when the document finishes loading. */
  onPickSubject?: (subject: string, appId: string) => void;
  /** When set, Login/Join now are replaced with an account menu. */
  user?: { email: string } | null;
  /** Called when the user picks "Sign out" from the account menu. */
  onSignOut?: () => void | Promise<void>;
  /** When provided, the Login button calls this (SPA navigation) instead of
   *  linking to `${homeUrl}/signin`. Use for apps that host their own /signin route. */
  onSignIn?: () => void;
  /** When provided, the "Join now" button calls this instead of linking to `${homeUrl}/signup`. */
  onSignUp?: () => void;
  /** Fired when a tool card in the Study-tools dropdown is clicked, with that app's id.
   *  Optional so `@repo/ui` stays free of analytics — the app injects an emitter
   *  (e.g. `(id) => track('nav_app_click', { to_app_id: id })`). */
  onAppClick?: (appId: string) => void;
}

function sameOrigin(url: string, origin: string): boolean {
  try { return new URL(url).origin === origin; } catch { return false; }
}

interface SubjectEntry { subject: string; appId: string; }

export function ScholiumNavbar({
  apps,
  onSettings,
  homeUrl = '',
  onPickSubject,
  user,
  onSignOut,
  onSignIn,
  onSignUp,
  onAppClick,
}: ScholiumNavbarProps) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const toolsRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const { isDark, toggle: toggleDark } = useDarkMode();
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  // Filter out scholium-home from the Study tools dropdown (it's "home", not a "tool").
  const toolApps = useMemo(
    () => (apps ?? []).filter(a => a.id !== 'scholium-home'),
    [apps],
  );

  // Build deduped subject → appId index from tool apps.
  const subjectIndex: SubjectEntry[] = useMemo(() => {
    const seen = new Set<string>();
    const out: SubjectEntry[] = [];
    for (const app of toolApps) {
      for (const subject of app.subjects ?? []) {
        const key = subject.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          out.push({ subject, appId: app.id });
        }
      }
    }
    return out;
  }, [toolApps]);

  // Filter suggestions as the user types.
  const suggestions: SubjectEntry[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subjectIndex.slice(0, 8);
    const starts = subjectIndex.filter(e => e.subject.toLowerCase().startsWith(q));
    const contains = subjectIndex.filter(
      e => !e.subject.toLowerCase().startsWith(q) && e.subject.toLowerCase().includes(q),
    );
    return [...starts, ...contains].slice(0, 8);
  }, [search, subjectIndex]);

  // Close dropdowns on outside click + Escape.
  useEffect(() => {
    if (!toolsOpen && !accountOpen && !searchOpen) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (toolsOpen && toolsRef.current && !toolsRef.current.contains(t)) setToolsOpen(false);
      if (accountOpen && accountRef.current && !accountRef.current.contains(t)) setAccountOpen(false);
      if (searchOpen && searchRef.current && !searchRef.current.contains(t)) setSearchOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setToolsOpen(false);
        setAccountOpen(false);
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [toolsOpen, accountOpen, searchOpen]);

  function pickSuggestion(entry: SubjectEntry) {
    setSearch('');
    setSearchOpen(false);
    if (onPickSubject) {
      onPickSubject(entry.subject, entry.appId);
    } else {
      const base = homeUrl || '';
      window.location.href = `${base}/?highlight=${encodeURIComponent(entry.appId)}`;
    }
  }

  function onSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!searchOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions[activeIdx]) pickSuggestion(suggestions[activeIdx]);
    }
  }

  const signinHref = `${homeUrl}/signin`;
  const signupHref = `${homeUrl}/signup`;
  const logoHref = homeUrl || '/';
  const accountInitial = user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <header className="rui-navbar">
      <div className="rui-navbar-inner">
        <a href={logoHref} className="rui-navbar-brand" aria-label="Scholium home">
          <ScholiumLogo size="sm" />
        </a>

        {/* ── Study tools dropdown ─────────────────────────────────── */}
        <div className="rui-navbar-tools" ref={toolsRef}>
          <button
            type="button"
            className="rui-navbar-tools-btn"
            onClick={() => { setToolsOpen(o => !o); setAccountOpen(false); setSearchOpen(false); }}
            aria-haspopup="true"
            aria-expanded={toolsOpen}
          >
            Study tools
            <svg
              width="10" height="10" viewBox="0 0 10 10" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true"
              className={`rui-navbar-chevron${toolsOpen ? ' rui-navbar-chevron--open' : ''}`}
            >
              <path d="M2 4 L5 7 L8 4" />
            </svg>
          </button>

          {toolsOpen && (
            <div className="rui-navbar-dropdown" role="menu">
              {toolApps.length > 0 ? (
                <div className="rui-apps-grid">
                  {toolApps.map(app => {
                    const current = sameOrigin(app.url, currentOrigin);
                    return (
                      <a
                        key={app.id}
                        href={app.url}
                        target={current ? '_self' : '_blank'}
                        rel="noopener noreferrer"
                        className={`rui-app-card${current ? ' rui-app-card--current' : ''}`}
                        role="menuitem"
                        onClick={() => { setToolsOpen(false); onAppClick?.(app.id); }}
                      >
                        {app.icon ? <span className="rui-app-icon">{app.icon}</span> : null}
                        <span className="rui-app-title">{app.title}</span>
                      </a>
                    );
                  })}
                </div>
              ) : (
                <p className="rui-apps-empty">No tools configured yet.</p>
              )}
            </div>
          )}
        </div>

        {/* ── Subject search with autocomplete ─────────────────────── */}
        <div className="rui-navbar-search" ref={searchRef}>
          <svg
            width="14" height="14" viewBox="0 0 14 14" fill="none"
            stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
            aria-hidden="true"
            className="rui-navbar-search-icon"
          >
            <circle cx="6" cy="6" r="4.25" />
            <path d="M9 9 L12 12" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={e => { setSearch(e.target.value); setSearchOpen(true); setActiveIdx(0); }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search a subject…"
            className="rui-navbar-search-input"
            aria-label="Search a subject"
            aria-autocomplete="list"
            aria-expanded={searchOpen && suggestions.length > 0}
          />
          {searchOpen && suggestions.length > 0 && (
            <ul className="rui-navbar-search-dropdown" role="listbox">
              {suggestions.map((entry, i) => (
                <li
                  key={`${entry.subject}-${entry.appId}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  className={`rui-navbar-search-item${i === activeIdx ? ' rui-navbar-search-item--active' : ''}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseDown={(e) => { e.preventDefault(); pickSuggestion(entry); }}
                >
                  <span className="rui-navbar-search-subject">{entry.subject}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Right cluster: dark-mode toggle + (settings or account) + auth ── */}
        <div className="rui-navbar-actions">
          <button
            type="button"
            className="rui-navbar-icon-btn"
            onClick={toggleDark}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Standalone gear only visible when NOT signed in (when signed in, Settings lives in the account menu) */}
          {onSettings && !user ? (
            <button
              type="button"
              className="rui-navbar-icon-btn"
              onClick={onSettings}
              aria-label="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          ) : null}

          {user ? (
            <div className="rui-navbar-account" ref={accountRef}>
              <button
                type="button"
                className="rui-navbar-avatar"
                onClick={() => { setAccountOpen(o => !o); setToolsOpen(false); setSearchOpen(false); }}
                aria-haspopup="true"
                aria-expanded={accountOpen}
                aria-label={`Account menu for ${user.email}`}
                title={user.email}
              >
                {accountInitial}
              </button>
              {accountOpen && (
                <div className="rui-navbar-account-menu" role="menu">
                  <div className="rui-navbar-account-email" title={user.email}>{user.email}</div>
                  {onSettings ? (
                    <button
                      type="button"
                      className="rui-navbar-account-item"
                      role="menuitem"
                      onClick={() => { setAccountOpen(false); onSettings(); }}
                    >
                      Settings
                    </button>
                  ) : null}
                  {onSignOut ? (
                    <button
                      type="button"
                      className="rui-navbar-account-item rui-navbar-account-item--danger"
                      role="menuitem"
                      onClick={async () => { setAccountOpen(false); await onSignOut(); }}
                    >
                      Sign out
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <>
              {onSignIn ? (
                <button type="button" onClick={onSignIn} className="rui-navbar-btn rui-navbar-btn--ghost">Login</button>
              ) : (
                <a href={signinHref} className="rui-navbar-btn rui-navbar-btn--ghost">Login</a>
              )}
              {onSignUp ? (
                <button type="button" onClick={onSignUp} className="rui-navbar-btn rui-navbar-btn--primary">Join now</button>
              ) : (
                <a href={signupHref} className="rui-navbar-btn rui-navbar-btn--primary">Join now</a>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
