import { useEffect, useState } from "react";
import { ScholiumFooter, ScholiumLogo, ScholiumNavbar, SCHOLIUM_HOME_URL } from "@repo/ui";
import type { AppLink } from "@repo/ui";
import { useBlog } from "../lib/context";

/**
 * The shared navbar reads localStorage (dark mode) and window.location during
 * render, so its server output and its first browser render can disagree — and a
 * hydration mismatch makes React throw the server HTML away. So the server and
 * the hydrating render both draw this same-height static bar, and the real navbar
 * replaces it once mounted. Crawlers lose nothing: there is no content up here.
 */
function NavbarPlaceholder() {
  return (
    <header className="rui-navbar" aria-hidden="true">
      <div className="rui-navbar-inner">
        <ScholiumLogo />
      </div>
    </header>
  );
}

function Navbar() {
  const { api } = useBlog();
  const [mounted, setMounted] = useState(false);
  const [apps, setApps] = useState<AppLink[]>([]);

  useEffect(() => {
    setMounted(true);
    api.listApps().then(setApps);
  }, [api]);

  if (!mounted) return <NavbarPlaceholder />;
  return <ScholiumNavbar apps={apps} homeUrl={SCHOLIUM_HOME_URL} />;
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Navbar />
      <main id="main" className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        {children}
      </main>
      <ScholiumFooter
        homeUrl={SCHOLIUM_HOME_URL}
        termsHref={`${SCHOLIUM_HOME_URL}/terms`}
        privacyHref={`${SCHOLIUM_HOME_URL}/privacy`}
      />
    </div>
  );
}
