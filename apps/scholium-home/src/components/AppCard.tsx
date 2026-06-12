import { useMemo, useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";

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
// "Lang. Hub" / host "language-flash-hub" → "language-hub"). These keyword
// aliases map such rows back to the right asset/meta key.
const SLUG_ALIASES: { slug: string; keywords: string[] }[] = [
  { slug: "language-hub", keywords: ["language", "lang"] },
  { slug: "recall-app", keywords: ["recall"] },
  { slug: "poetry-notes", keywords: ["poetry"] },
  { slug: "past-papers", keywords: ["past-paper", "pastpaper", "past papers"] },
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
  highlighted?: boolean;
  imageSide?: "left" | "right";
}

export default function AppCard({
  id,
  title,
  url,
  icon,
  subjects,
  description,
  highlighted,
  imageSide = "right",
}: AppCardProps) {
  const slug = useMemo(() => resolveAppSlug(title, url), [title, url]);
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
        transform: "translateY(-2px) scale(1.005)",
      }
    : { boxShadow: "var(--shadow-card)" };

  const rowDirection =
    imageSide === "left" ? "md:flex-row-reverse" : "md:flex-row";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-app-id={id}
      className={`sch-focus group relative flex flex-col ${rowDirection} bg-paper rounded-[var(--radius-lg)] border border-[color:var(--color-border)] overflow-hidden transition-all duration-500`}
      style={highlightStyle}
      onMouseEnter={(e) => {
        if (highlighted) return;
        e.currentTarget.style.boxShadow = "var(--shadow-hover)";
        e.currentTarget.style.borderColor = accent;
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        if (highlighted) return;
        e.currentTarget.style.boxShadow = "var(--shadow-card)";
        e.currentTarget.style.borderColor = "";
        e.currentTarget.style.transform = "";
      }}
    >
      {/* Text side */}
      <div className="flex-1 p-8 md:p-10 flex flex-col">
        <div
          className="w-12 h-12 flex items-center justify-center rounded-[var(--radius-sm)] text-2xl mb-5 border"
          style={{
            background: accentSoft,
            borderColor: accent,
            color: accent,
          }}
        >
          {icon ? icon : <Sparkles size={22} strokeWidth={2} aria-hidden />}
        </div>

        <h3
          className="text-foreground mb-1"
          style={{
            fontSize: "1.6rem",
            fontWeight: 700,
            letterSpacing: "-0.015em",
            lineHeight: 1.2,
          }}
        >
          {title}
        </h3>

        {meta && (
          <p className="text-sm font-semibold mb-3" style={{ color: accent }}>
            {meta.tagline}
          </p>
        )}

        {resolvedDescription && (
          <p className="text-sm text-muted-foreground leading-relaxed flex-1">
            {resolvedDescription}
          </p>
        )}

        <div className="mt-6 pt-5 border-t border-[color:var(--color-rule)] flex items-center justify-between gap-3">
          {hasSubjects ? (
            <ul className="flex flex-wrap items-center gap-1.5 list-none m-0 p-0">
              {subjects!.map((subject) => (
                <li
                  key={subject}
                  className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] px-2 py-1 rounded-full"
                  style={{
                    background: accentSoft,
                    color: accent,
                    border: `1px solid hsl(var(${accentVar}) / 0.3)`,
                  }}
                >
                  {subject}
                </li>
              ))}
            </ul>
          ) : (
            <span />
          )}
          <ArrowUpRight
            size={18}
            className="flex-shrink-0 transition-all group-hover:translate-x-1 group-hover:-translate-y-1"
            style={{ color: accent }}
          />
        </div>
      </div>

      {/* Image side */}
      {hasScreenshot && (
        <div
          className="md:w-3/5 md:flex-shrink-0 relative overflow-hidden"
          style={{ background: accentSoft }}
        >
          <img
            src={screenshotUrl}
            alt={`${title} screenshot`}
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="w-full h-full object-cover object-center"
            style={{ minHeight: "560px" }}
          />
        </div>
      )}
    </a>
  );
}
