import { useMemo } from "react";
import type { AppLink } from "@repo/ui";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen,
  Calculator,
  Feather,
  Landmark,
  Globe,
  FlaskConical,
  Leaf,
  Zap,
  Languages,
  TrendingUp,
  Briefcase,
  Monitor,
  Music,
  Palette,
  Drama,
  Brain,
  Lightbulb,
  BookMarked,
  Microscope,
} from "lucide-react";

const SUBJECT_ICONS: Record<string, LucideIcon> = {
  mathematics: Calculator,
  maths: Calculator,
  math: Calculator,
  "international mathematics": Calculator,
  english: BookOpen,
  literature: BookOpen,
  poetry: Feather,
  history: Landmark,
  geography: Globe,
  science: FlaskConical,
  biology: Leaf,
  chemistry: FlaskConical,
  physics: Zap,
  french: Languages,
  spanish: Languages,
  languages: Languages,
  "second language french": Languages,
  "second language spanish": Languages,
  economics: TrendingUp,
  business: Briefcase,
  computing: Monitor,
  "computer science": Monitor,
  music: Music,
  art: Palette,
  drama: Drama,
  psychology: Brain,
  philosophy: Lightbulb,
  "religious studies": BookMarked,
  rs: BookMarked,
  "social studies": BookMarked,
  sociology: Microscope,
};

interface SubjectPickerProps {
  apps: AppLink[];
  onPick: (subject: string, appIds: string[]) => void;
}

interface SubjectEntry {
  subject: string;
  appIds: string[];
}

export default function SubjectPicker({ apps, onPick }: SubjectPickerProps) {
  const entries: SubjectEntry[] = useMemo(() => {
    const byKey = new Map<string, SubjectEntry>();
    for (const app of apps) {
      if (app.id === "scholium-home") continue;
      for (const subject of app.subjects ?? []) {
        const key = subject.toLowerCase();
        const existing = byKey.get(key);
        if (existing) {
          if (!existing.appIds.includes(app.id)) existing.appIds.push(app.id);
        } else {
          byKey.set(key, { subject, appIds: [app.id] });
        }
      }
    }
    return Array.from(byKey.values()).sort((a, b) => a.subject.localeCompare(b.subject));
  }, [apps]);

  if (entries.length === 0) return null;

  return (
    <section id="subjects" className="py-20 border-t border-[color:var(--color-rule)]">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2
          className="text-foreground mb-3"
          style={{
            fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
            lineHeight: 1.1,
            letterSpacing: "-0.02em",
            fontWeight: 700,
          }}
        >
          Choose your <span style={{ color: "hsl(var(--primary))" }}>subject</span>.
        </h2>
        <p className="text-foreground/75 leading-relaxed mb-8">
          Pick a subject and we'll point you to the tool that covers it.
        </p>

        <ul className="flex flex-wrap items-center justify-center gap-2 list-none p-0 m-0">
          {entries.map((entry) => {
            const Icon = SUBJECT_ICONS[entry.subject.toLowerCase()];
            return (
              <li key={`${entry.subject}-${entry.appIds.join(",")}`}>
                <button
                  type="button"
                  onClick={() => onPick(entry.subject, entry.appIds)}
                  className="sch-focus inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all"
                  style={{
                    background: "hsl(var(--primary) / 0.08)",
                    color: "hsl(var(--primary))",
                    border: "1px solid hsl(var(--primary) / 0.3)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "hsl(var(--primary))";
                    e.currentTarget.style.color = "hsl(var(--primary-foreground))";
                    e.currentTarget.style.transform = "translateY(-1px)";
                    e.currentTarget.style.boxShadow = "var(--shadow-soft)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "hsl(var(--primary) / 0.08)";
                    e.currentTarget.style.color = "hsl(var(--primary))";
                    e.currentTarget.style.transform = "";
                    e.currentTarget.style.boxShadow = "";
                  }}
                >
                  {Icon && <Icon size={14} aria-hidden strokeWidth={2} className="shrink-0" />}
                  {entry.subject}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
