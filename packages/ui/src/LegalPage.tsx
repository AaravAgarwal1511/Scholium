import type { ReactNode } from 'react';
import { ScholiumLogo } from './ScholiumLogo';
import './legal.css';

export interface LegalPageProps {
  title: string;
  /** Human-readable effective date, e.g. "5 July 2026". */
  lastUpdated: string;
  /** Absolute URL of the Scholium hub for the brand link. Defaults to "/". */
  homeUrl?: string;
  children: ReactNode;
}

/** Standalone, router-agnostic legal-document shell (Terms, Privacy, etc.).
 *  Renders its own header + prose column so it works whether it's mounted
 *  under an app's navbar or served on its own (e.g. poetry-notes). */
export function LegalPage({ title, lastUpdated, homeUrl = '/', children }: LegalPageProps) {
  return (
    <div className="rui-legal">
      <div className="rui-legal-inner">
        <header className="rui-legal-header">
          <a href={homeUrl} className="rui-legal-brand" aria-label="Scholium home">
            <ScholiumLogo size="sm" />
          </a>
          <h1 className="rui-legal-title">{title}</h1>
          <p className="rui-legal-updated">Last updated: {lastUpdated}</p>
        </header>

        <article className="rui-legal-prose">{children}</article>
      </div>
    </div>
  );
}
