// Entry point for prerender-legal.mjs's Vite SSR build — not shipped to the
// browser, and not covered by tsconfig.app.json (which only includes src/**;
// this lives in scripts/ alongside the plain-JS generators it runs next to).
//
// Renders @repo/ui's shared Terms/Privacy components to a plain HTML string
// with react-dom/server, the same source every other Scholium app uses for
// its own /terms and /privacy routes — so prerendering here can never drift
// from what the SPA itself would show at those paths.
import { renderToStaticMarkup } from "react-dom/server";
import { TermsOfService, PrivacyPolicy } from "@repo/ui";

export function renderTerms(homeUrl: string): string {
  return renderToStaticMarkup(<TermsOfService homeUrl={homeUrl} />);
}

export function renderPrivacy(homeUrl: string): string {
  return renderToStaticMarkup(<PrivacyPolicy homeUrl={homeUrl} />);
}
