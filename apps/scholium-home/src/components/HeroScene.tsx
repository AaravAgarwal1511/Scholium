// Self-contained, on-brand hero backdrop — no external assets.
// It draws the one idea Scholium is built on: memory fades on its own, but
// spaced review lifts it back up each time (the spacing effect). The primary
// line climbs with each review; the dashed accent line is what happens
// without it. Colours are the design tokens (not literal hex) so dark mode
// re-tints the scene for free, and the light-mode token values match the
// original indigo/amber pixel-for-pixel.

const PRIMARY = "hsl(var(--primary))";
const ACCENT = "hsl(var(--accent))";

// Retention line that decays, then jumps back up at each spaced review.
const REVIEW_LINE =
  "M40 96 C90 176 140 206 190 210 L190 74 C244 128 294 156 340 160 L340 54 C394 100 444 118 490 122 L490 40 C526 60 552 72 575 78";

// What forgetting looks like with no review — a lonely decay toward the floor.
const DECAY_LINE = "M40 96 C150 220 300 300 575 328";

// x-positions where a review happens (markers sit on the top of each jump).
const REVIEWS = [
  { x: 190, y: 74 },
  { x: 340, y: 54 },
  { x: 490, y: 40 },
];

export default function HeroScene() {
  return (
    <div
      className="absolute inset-0 overflow-hidden"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 70% 55% at 18% 18%, hsl(var(--primary) / 0.16), transparent 60%)," +
          "radial-gradient(ellipse 62% 55% at 86% 82%, hsl(var(--accent) / 0.14), transparent 60%)," +
          "linear-gradient(158deg, hsl(var(--background)) 0%, hsl(var(--secondary)) 100%)",
      }}
    >
      {/* Retention chart — anchored to the right so it sits beside the copy. */}
      <svg
        viewBox="0 0 600 400"
        preserveAspectRatio="xMidYMid meet"
        className="absolute right-0 top-0 h-full w-full md:w-[64%]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="sch-hero-review-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PRIMARY} stopOpacity="0.16" />
            <stop offset="100%" stopColor={PRIMARY} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* faint baseline grid */}
        {[110, 180, 250, 320].map((y) => (
          <line
            key={y}
            x1="40"
            y1={y}
            x2="575"
            y2={y}
            stroke="currentColor"
            strokeOpacity="0.06"
            strokeWidth="1"
            className="text-foreground"
          />
        ))}
        <line
          x1="40"
          y1="340"
          x2="575"
          y2="340"
          stroke="currentColor"
          strokeOpacity="0.14"
          strokeWidth="1.5"
          className="text-foreground"
        />

        {/* area under the review line */}
        <path
          d={`${REVIEW_LINE} L575 340 L40 340 Z`}
          fill="url(#sch-hero-review-fill)"
          className="hero-area"
        />

        {/* forgetting curve without review */}
        <path
          d={DECAY_LINE}
          fill="none"
          stroke={ACCENT}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="2 8"
          className="hero-decay"
        />

        {/* the spaced-review retention line */}
        <path
          d={REVIEW_LINE}
          fill="none"
          stroke={PRIMARY}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="hero-review"
        />

        {/* review markers */}
        {REVIEWS.map((p, i) => (
          <g key={i} className="hero-marker" style={{ animationDelay: `${1.4 + i * 0.35}s` }}>
            <circle cx={p.x} cy={p.y} r="9" fill={PRIMARY} fillOpacity="0.16" />
            <circle cx={p.x} cy={p.y} r="4.5" fill="hsl(var(--background))" stroke={PRIMARY} strokeWidth="2.5" />
          </g>
        ))}
      </svg>

      {/* Floating flashcards — real Scholium moments, gently bobbing. */}
      <div className="hero-card hero-card--a hidden md:block">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: PRIMARY }}>
          Lang. Hub
        </p>
        <p className="mt-1.5 text-lg font-semibold text-foreground" style={{ letterSpacing: "-0.01em" }}>
          s&apos;épanouir
        </p>
        <p className="text-sm text-muted-foreground">to flourish · verb</p>
        <div className="mt-3 flex gap-1.5">
          <span className="h-1.5 w-6 rounded-full" style={{ background: PRIMARY }} />
          <span className="h-1.5 w-6 rounded-full" style={{ background: "hsl(var(--primary) / 0.3)" }} />
          <span className="h-1.5 w-6 rounded-full" style={{ background: "hsl(var(--primary) / 0.3)" }} />
        </div>
      </div>

      <div className="hero-card hero-card--b hidden lg:block">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: ACCENT }}>
          Recall Master
        </p>
        <p className="mt-1.5 text-sm font-medium text-foreground/80">Four passes to mastery</p>
        <div className="mt-2.5 flex flex-col gap-1.5">
          {["Match", "Choose", "Recall", "Write"].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <span
                className="h-3.5 w-3.5 rounded-full"
                style={
                  i <= 1
                    ? { background: ACCENT }
                    : { border: "1px solid var(--color-border)" }
                }
              />
              <span className={`text-xs ${i <= 1 ? "text-foreground/75" : "text-muted-foreground"}`}>
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
