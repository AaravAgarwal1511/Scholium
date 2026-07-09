import { ScholiumLogo } from "@repo/ui";
import type { AppLink } from "@repo/ui";

interface FooterProps {
  apps: AppLink[];
}

export default function Footer({ apps }: FooterProps) {
  const toolApps = apps.filter((a) => a.id !== "scholium-home");

  return (
    <footer className="border-t border-[color:var(--color-rule)] bg-paper">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-12 gap-8 items-start">
          <div className="col-span-12 sm:col-span-4 flex flex-col gap-3">
            <ScholiumLogo size="sm" />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
              Learning tools that respect your memory, and your attention.
            </p>
          </div>

          <div className="col-span-6 sm:col-span-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              The suite
            </p>
            <nav className="flex flex-col gap-1.5">
              {toolApps.map((app) => (
                <a
                  key={app.id}
                  href={app.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-foreground/75 hover:text-primary transition-colors w-fit"
                >
                  {app.title}
                </a>
              ))}
            </nav>
          </div>

          <div className="col-span-6 sm:col-span-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Learn
            </p>
            <nav className="flex flex-col gap-1.5">
              <a
                href="/memory-science"
                className="text-sm text-foreground/75 hover:text-primary transition-colors w-fit"
              >
                The memory science
              </a>
            </nav>
          </div>

          <div className="col-span-6 sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Legal
            </p>
            <nav className="flex flex-col gap-1.5">
              <a
                href="/terms"
                className="text-sm text-foreground/75 hover:text-primary transition-colors w-fit"
              >
                Terms of Service
              </a>
              <a
                href="/privacy"
                className="text-sm text-foreground/75 hover:text-primary transition-colors w-fit"
              >
                Privacy Policy
              </a>
            </nav>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[color:var(--color-rule)]">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Scholium. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
