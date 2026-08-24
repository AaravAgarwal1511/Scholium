import './legal.css';

export interface ScholiumFooterProps {
  /** Path/URL for the Terms page. Same-origin route in every app. */
  termsHref?: string;
  /** Path/URL for the Privacy page. */
  privacyHref?: string;
  /** Optional home/brand URL. */
  homeUrl?: string;
  /** Path/URL for the About page. Defaults to `${homeUrl}/about` (a trailing
   *  slash on `homeUrl` is normalized away), since About only exists on the
   *  scholium-home hub — every tool app needs the absolute cross-app link,
   *  while scholium-home's own pages pass `homeUrl="/"` and get the relative
   *  `/about` for free. Pass explicitly to override. */
  aboutHref?: string;
}

/** Minimal, router-agnostic site footer referencing the legal pages. Uses plain
 *  anchors so it works in every app (including poetry-notes, which has no
 *  react-router). Theming comes from tokens.css. */
export function ScholiumFooter({
  termsHref = '/terms',
  privacyHref = '/privacy',
  homeUrl,
  aboutHref,
}: ScholiumFooterProps) {
  const year = new Date().getFullYear();
  const resolvedAboutHref = aboutHref ?? `${(homeUrl ?? '').replace(/\/$/, '')}/about`;
  return (
    <footer className="rui-footer">
      <div className="rui-footer-inner">
        <p className="rui-footer-copy">
          © {year} {homeUrl ? <a href={homeUrl}>Scholium</a> : 'Scholium'}. All rights reserved.
        </p>
        <nav className="rui-footer-links" aria-label="Footer">
          <a href={resolvedAboutHref}>About</a>
          <a href={termsHref}>Terms of Service</a>
          <a href={privacyHref}>Privacy Policy</a>
        </nav>
      </div>
    </footer>
  );
}
