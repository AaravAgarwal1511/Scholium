import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { ScholiumLogo, useDarkMode } from "@repo/ui";

const glassBtn: React.CSSProperties = {
  background: "hsl(var(--background) / 0.55)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid hsl(var(--border) / 0.7)",
};

export default function Nav() {
  const { isDark, toggle } = useDarkMode();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 w-full transition-all duration-200 ${
        scrolled
          ? "bg-background/90 backdrop-blur-md border-b border-border"
          : "bg-transparent"
      }`}
      style={scrolled ? { boxShadow: "var(--shadow-card)" } : undefined}
    >
      <div className="container mx-auto flex items-center justify-between h-16 px-4 sm:px-6">
        <a href="/" aria-label="Scholium home" className="inline-flex items-center">
          <ScholiumLogo size="md" />
        </a>

        <button
          onClick={toggle}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          style={glassBtn}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </nav>
  );
}
