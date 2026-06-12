import { GraduationCap, Presentation, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Persona = "student" | "teacher" | "parent";

const PERSONAS: { id: Persona; label: string; Icon: LucideIcon }[] = [
  { id: "student", label: "I'm a student", Icon: GraduationCap },
  { id: "teacher", label: "I'm a teacher", Icon: Presentation },
  { id: "parent", label: "I'm a parent", Icon: Users },
];

interface PersonaSelectorProps {
  selected: Persona | null;
  onSelect: (p: Persona | null) => void;
  dismissing?: boolean;
}

export default function PersonaSelector({ selected, onSelect, dismissing }: PersonaSelectorProps) {
  return (
    <div
      className="text-center"
      style={
        dismissing
          ? { animation: "rui-slide-out-right 0.38s var(--ease-in-paper) forwards" }
          : undefined
      }
    >
      <p className="text-sm text-muted-foreground mb-6 tracking-wide">
        Who's it for?
      </p>
      <div className="flex flex-col items-center gap-3 w-full">
        {PERSONAS.map(({ id, label, Icon }) => {
          const isActive = selected === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(isActive ? null : id)}
              aria-pressed={isActive}
              className="sch-focus inline-flex items-center gap-3 px-7 py-5 rounded-[var(--radius-sm)] text-lg font-semibold transition-all justify-center w-full"
                style={
                  isActive
                    ? {
                        background: "hsl(var(--primary))",
                        color: "hsl(var(--primary-foreground))",
                        border: "1px solid hsl(var(--primary))",
                        boxShadow: "var(--shadow-soft)",
                      }
                    : {
                        background: "transparent",
                        color: "hsl(var(--foreground))",
                        border: "1px solid var(--color-border)",
                      }
                }
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = "hsl(var(--primary))";
                    e.currentTarget.style.color = "hsl(var(--primary))";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = "var(--color-border)";
                    e.currentTarget.style.color = "hsl(var(--foreground))";
                  }
                }}
              >
                <Icon size={20} strokeWidth={2} aria-hidden="true" />
                {label}
              </button>
            );
          })}
      </div>
    </div>
  );
}
