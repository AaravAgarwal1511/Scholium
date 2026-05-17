import { useState, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { ScholiumLogo } from './ScholiumLogo';
import './AppHeroHeader.css';

export interface AppLink {
  id: string;
  title: string;
  url: string;
  icon?: string | null;
}

export interface AppHeroHeaderProps {
  title: string;
  subtitle?: string;
  onSettings?: () => void;
  apps?: AppLink[];
  children?: ReactNode;
}

function sameOrigin(url: string, origin: string): boolean {
  try { return new URL(url).origin === origin; } catch { return false; }
}

export function AppHeroHeader({ title, subtitle, onSettings, apps, children }: AppHeroHeaderProps) {
  const [appsOpen, setAppsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    if (!appsOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setAppsOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setAppsOpen(false);
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [appsOpen]);

  return (
    <header className="rui-hero-header" data-tour="hero">
      <div className="rui-hero-brand">
        <ScholiumLogo size="sm" />
      </div>

      <div className="rui-hero-top-right">
        {apps !== undefined && (
          <div className="rui-apps-wrapper" ref={wrapperRef}>
            <button
              className="rui-hero-icon-btn"
              onClick={() => setAppsOpen(o => !o)}
              aria-label="Scholium apps"
              aria-expanded={appsOpen}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
                <rect x="0"   y="0"   width="5" height="5" rx="1.25"/>
                <rect x="6.5" y="0"   width="5" height="5" rx="1.25"/>
                <rect x="13"  y="0"   width="5" height="5" rx="1.25"/>
                <rect x="0"   y="6.5" width="5" height="5" rx="1.25"/>
                <rect x="6.5" y="6.5" width="5" height="5" rx="1.25"/>
                <rect x="13"  y="6.5" width="5" height="5" rx="1.25"/>
                <rect x="0"   y="13"  width="5" height="5" rx="1.25"/>
                <rect x="6.5" y="13"  width="5" height="5" rx="1.25"/>
                <rect x="13"  y="13"  width="5" height="5" rx="1.25"/>
              </svg>
            </button>

            {appsOpen && (
              <div className="rui-apps-dropdown" role="menu">
                <p className="rui-apps-dropdown-label">Scholium Apps</p>
                {apps.length === 0 ? (
                  <p className="rui-apps-empty">No apps configured yet.</p>
                ) : (
                  <div className="rui-apps-grid">
                    {apps.map(app => {
                      const current = sameOrigin(app.url, currentOrigin);
                      return (
                        <a
                          key={app.id}
                          href={app.url}
                          target={current ? '_self' : '_blank'}
                          rel="noopener noreferrer"
                          className={`rui-app-card${current ? ' rui-app-card--current' : ''}`}
                          role="menuitem"
                          onClick={() => setAppsOpen(false)}
                        >
                          {app.icon ? <span className="rui-app-icon">{app.icon}</span> : null}
                          <span className="rui-app-title">{app.title}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {onSettings ? (
          <button
            className="rui-hero-icon-btn"
            onClick={onSettings}
            aria-label="Settings"
            data-tour="settings-btn"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        ) : null}
      </div>

      <div className="rui-hero-body">
        <h1 className="rui-hero-title">{title}</h1>
        {subtitle ? <p className="rui-hero-subtitle">{subtitle}</p> : null}
        {children ? <div className="rui-hero-actions">{children}</div> : null}
      </div>
    </header>
  );
}
