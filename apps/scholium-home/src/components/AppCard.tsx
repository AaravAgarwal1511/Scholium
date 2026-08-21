import { useMemo, useState } from "react";
import { ArrowUpRight, LockOpen, PlayCircle, Sparkles } from "lucide-react";
import { useAnalytics } from "@repo/analytics";

// Fallback for tools with a no-signup trial at `<app-url>/demo`, used only when
// the DB `has_demo` flag is absent (e.g. before the tags migration is applied).
const DEMO_SLUGS = new Set(["language-hub", "recall-app", "poetry-notes", "mock-space"]);

const APP_META: Record<
  string,
  { tagline: string; description: string; accentVar: string }
> = {
  "language-hub": {
    tagline: "Vocabulary in French & Spanish",
    description:
      "Flashcards, drills, and dictation in two languages. Build sets, track translations, and watch words become yours.",
    accentVar: "--primary",
  },
  "recall-app": {
    tagline: "Active recall, in passes",
    description:
      "Match, choose, recall, write. Each pass deepens the trace until the answer is yours.",
    accentVar: "--accent",
  },
  "poetry-notes": {
    tagline: "Annotate poetry with linked notes",
    description:
      "Mark up poems and build interconnected glosses. Selections become anchors; notes become a canvas around the text.",
    accentVar: "--primary",
  },
  "past-papers": {
    tagline: "Topical IGCSE exam practice",
    description:
      "Past papers and mark schemes, organised by subject, component, and chapter. Track what's been tried.",
    accentVar: "--accent",
  },
  "mock-space": {
    tagline: "Sit a past paper under exam conditions",
    description:
      "Type straight onto the PDF — the cursor only ever moves forwards, so you can never quietly reword an answer before you mark it.",
    accentVar: "--primary",
  },
};

const screenshotModules = import.meta.glob<{ default: string }>(
  "../assets/screenshots/*.png",
  { eager: true },
);
const screenshotBySlug: Record<string, string> = Object.fromEntries(
  Object.entries(screenshotModules).map(([path, mod]) => {
    const slug = path.split("/").pop()!.replace(/\.png$/, "");
    return [slug, mod.default];
  }),
);

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// The suite is loaded from the DB, where a tool's title/URL may not slugify to
// the canonical key used by APP_META and the screenshot assets (e.g. DB title
// "Lang. Hub" / host "langhub" → "language-hub"). These keyword aliases map
// such rows back to the right asset/meta key.
const SLUG_ALIASES: { slug: string; keywords: string[] }[] = [
  { slug: "language-hub", keywords: ["language", "lang"] },
  { slug: "recall-app", keywords: ["recall"] },
  { slug: "poetry-notes", keywords: ["poetry"] },
  { slug: "past-papers", keywords: ["past-paper", "pastpaper", "past papers"] },
  { slug: "mock-space", keywords: ["mock", "mockspace"] },
];

function candidateSlugs(title: string, url: string): string[] {
  const out: string[] = [];
  const push = (s: string | undefined | null) => {
    if (s && !out.includes(s)) out.push(s);
  };
  const titleSlug = slugify(title);
  push(titleSlug);
  push(`${titleSlug}-app`);
  push(titleSlug.replace(/-app$/, ""));
  try {
    const u = new URL(url);
    const hostParts = u.hostname.split(".");
    push(hostParts[0]);
    if (hostParts[0]) {
      push(`${hostParts[0]}-app`);
      push(hostParts[0].replace(/-app$/, ""));
    }
    const pathFirst = u.pathname.split("/").filter(Boolean)[0];
    push(pathFirst);
  } catch {
    /* not a URL — skip */
  }
  return out;
}

function resolveAppSlug(title: string, url: string): string {
  const candidates = candidateSlugs(title, url);
  // Prefer one that has a screenshot, then one that has APP_META.
  for (const c of candidates) if (screenshotBySlug[c]) return c;
  for (const c of candidates) if (APP_META[c]) return c;
  // Fall back to keyword aliases for known tools whose DB title/URL doesn't
  // slugify to the canonical key (e.g. "Lang. Hub", "Recall Master").
  const haystack = `${title} ${url}`.toLowerCase();
  for (const { slug, keywords } of SLUG_ALIASES) {
    if (keywords.some((k) => haystack.includes(k))) return slug;
  }
  return candidates[0] ?? slugify(title);
}

interface AppCardProps {
  id: string;
  title: string;
  url: string;
  icon?: string | null;
  subjects?: string[] | null;
  description?: string | null;
  has_demo?: boolean | null;
  no_login?: boolean | null;
  highlighted?: boolean;
}

export default function AppCard({
  id,
  title,
  url,
  icon,
  subjects,
  description,
  has_demo,
  no_login,
  highlighted,
}: AppCardProps) {
  const { track } = useAnalytics();
  const slug = useMemo(() => resolveAppSlug(title, url), [title, url]);
  const showDemo = has_demo ?? DEMO_SLUGS.has(slug);
  const tryUrl = showDemo ? `${url.replace(/\/+$/, "")}/demo` : null;
  const meta = APP_META[slug];
  const accentVar = meta?.accentVar ?? "--primary";
  const accent = `hsl(var(${accentVar}))`;
  const accentSoft = `hsl(var(${accentVar}) / 0.1)`;
  const hasSubjects = subjects && subjects.length > 0;
  const resolvedDescription = description ?? meta?.description ?? null;
  const [imageFailed, setImageFailed] = useState(false);

  const screenshotUrl = screenshotBySlug[slug];
  const hasScreenshot = !imageFailed && Boolean(screenshotUrl);

  const highlightStyle: React.CSSProperties = highlighted
    ? {
        outline: `2px solid ${accent}`,
        outlineOffset: "2px",
        boxShadow: `0 0 0 6px hsl(var(${accentVar}) / 0.18), var(--shadow-hover)`,
        transform: "translateY(-4px)",
      }
    : {};

  return (
    <div id={`app-${id}`} className="relative scroll-mt-24">
      {/* Demo/no-login badges are siblings of the card link, not children of
          it — an <a> nested inside an <a> is invalid HTML (React warns via
          validateDOMNesting) and browsers handle its click target
          unpredictably. Absolutely positioned to sit visually over the
          screenshot corner instead. */}
      {(tryUrl || no_login) && (
        <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
          {tryUrl && (
            <a
              href={tryUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("demo_click", { app_id: id })}
              className="sch-focus inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.08em] shadow-soft"
              style={{ background: "hsl(var(--card))", color: accent, border: `1px solid ${accent}` }}
              aria-label={`Try ${title} free, no account needed`}
            >
              <PlayCircle size={14} strokeWidth={2.25} aria-hidden />
              Try it free
            </a>
          )}
          {no_login && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.08em] shadow-soft"
              style={{
                background: "hsl(var(--card))",
                color: accent,
                border: `1px solid hsl(var(${accentVar}) / 0.3)`,
              }}
            >
              <LockOpen size={14} strokeWidth={2.25} aria-hidden />
              No login required
            </span>
          )}
        </div>
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        data-app-id={id}
        onClick={() => track("app_card_click", { app_id: id, source: "grid" })}
        className="sch-focus group relative flex flex-col rounded-[var(--radius-lg)] overflow-hidden bg-paper border transition-all duration-300 hover:-translate-y-1"
        style={{
          borderColor: "var(--color-border)",
          boxShadow: highlighted ? undefined : "var(--shadow-card)",
          ...highlightStyle,
        }}
      >
        {/* Screenshot */}
        <div className="relative overflow-hidden" style={{ background: accentSoft }}>
          {hasScreenshot ? (
            <img
              src={screenshotUrl}
              alt={`${title} screenshot`}
              loading="lazy"
              width={2400}
              height={1600}
              onError={() => setImageFailed(true)}
              className="w-full aspect-[3/2] object-cover object-top transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="w-full aspect-[3/2] flex items-center justify-center" style={{ color: accent }}>
              {icon ? (
                <span className="text-6xl" aria-hidden>
                  {icon}
                </span>
              ) : (
                <Sparkles size={48} strokeWidth={1.5} aria-hidden />
              )}
            </div>
          )}
        </div>

        {/* Text */}
        <div className="p-8 flex flex-col flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-foreground text-2xl font-semibold leading-tight" style={{ letterSpacing: "-0.02em" }}>
                {icon && <span className="mr-2" aria-hidden>{icon}</span>}
                {title}
              </h3>
              {meta && (
                <p className="mt-1 text-sm font-semibold" style={{ color: accent }}>
                  {meta.tagline}
                </p>
              )}
            </div>
            <ArrowUpRight
              size={20}
              className="flex-shrink-0 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              style={{ color: accent }}
            />
          </div>

          {resolvedDescription && (
            <p className="mt-4 text-base text-muted-foreground leading-relaxed flex-1">{resolvedDescription}</p>
          )}

          {hasSubjects && (
            <div className="mt-6 pt-5 border-t flex flex-wrap gap-1.5" style={{ borderColor: "var(--color-rule)" }}>
              {subjects!.map((subject) => (
                <span
                  key={subject}
                  className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full"
                  style={{ background: accentSoft, color: accent, border: `1px solid hsl(var(${accentVar}) / 0.3)` }}
                >
                  {subject}
                </span>
              ))}
            </div>
          )}
        </div>
      </a>
    </div>
  );
}
