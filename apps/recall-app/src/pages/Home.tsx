import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useApp } from "@/contexts/AppContext";
import { useSubjects } from "@/hooks/useSubjects";
import { TwoSiderLauncher } from "@/components/TwoSiderLauncher";
import type { Chapter, Section, Subject } from "@/types";
import { PASS_CONFIG } from "@/components/PassBadge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

function ChapterRow({
  chapter,
  pass,
  onPassChange,
  onStudy,
}: {
  chapter: Chapter;
  pass: number;
  onPassChange: (id: string, newPass: number) => void;
  onStudy: (chapter: Chapter, pass: number) => void;
}) {
  const color = PASS_CONFIG[pass] || PASS_CONFIG[1];
  return (
    <div
      className={cn(
        "rounded-lg border-2 bg-card shadow-card p-4 flex items-center justify-between gap-3 group hover:shadow-hover hover:-translate-y-0.5 transition-all duration-200",
        color.ring,
      )}
    >
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={() => onStudy(chapter, pass)}
      >
        <div className="font-semibold text-sm text-foreground truncate">
          {chapter.name}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {chapter.cardCount ?? chapter.cards.length} terms
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors",
                color.bg,
                color.text,
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", color.dot)} />
              P{pass}
              <ChevronDown size={10} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Set pass level</DropdownMenuLabel>
            {[1, 2, 3, 4].map((v) => {
              const c = PASS_CONFIG[v];
              const active = v === pass;
              return (
                <DropdownMenuItem
                  key={v}
                  onSelect={() => onPassChange(chapter.id, v)}
                  className={cn(
                    "gap-2.5",
                    active && "bg-primary text-primary-foreground focus:bg-primary/90 focus:text-primary-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      active ? "bg-white" : c.dot,
                    )}
                  />
                  {c.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="accent"
          size="sm"
          onClick={() => onStudy(chapter, pass)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-xs px-3 h-8"
        >
          Study
        </Button>
      </div>
    </div>
  );
}

function SectionCard({
  subject,
  section,
  onStudy,
}: {
  subject: Subject;
  section: Section;
  onStudy: (chapter: Chapter, pass: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { passes, setPassForChapter } = useApp();
  const totalCards = section.chapters.reduce(
    (s, c) => s + (c.cardCount ?? c.cards.length),
    0,
  );

  async function handlePassChange(id: string, newPass: number) {
    await setPassForChapter(id, newPass);
    toast.success(`Pass updated to ${newPass}`);
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-xl border-2 border-border bg-card shadow-card overflow-hidden transition-all duration-300 hover:shadow-hover"
    >
      <CollapsibleTrigger className="w-full flex items-center justify-between p-5 hover:bg-secondary/50 transition-colors text-left">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0",
              subject.accent === "blue" ? "bg-primary/10" : "bg-accent/10",
            )}
          >
            {subject.emoji}
          </div>
          <div>
            <div className="font-bold text-foreground">{section.name}</div>
            <div className="text-xs text-muted-foreground">
              {section.chapters.length} chapters · {totalCards} terms
            </div>
          </div>
        </div>
        <ChevronDown
          size={18}
          className={cn(
            "text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-5 pb-5 flex flex-col gap-2 border-t border-border pt-4">
          {section.chapters.map((ch) => (
            <ChapterRow
              key={ch.id}
              chapter={ch}
              pass={passes[ch.id] || 1}
              onPassChange={handlePassChange}
              onStudy={onStudy}
            />
          ))}
          <button
            onClick={() => navigate(`/practice-section/${section.id}`)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg gradient-warm text-white font-semibold text-sm hover:opacity-90 transition-opacity mt-1"
          >
            <Zap size={14} />
            Practice 30 Random Definitions
          </button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function Home({ description }: { description?: string | null } = {}) {
  const navigate = useNavigate();
  const { user, loadingAuth } = useApp();
  const { subjects, loading: loadingSubjects } = useSubjects();
  const [activeSubject, setActiveSubject] = useState<string | null>(null);

  const subject = subjects.find((s) => s.id === activeSubject) ?? subjects[0];

  if (loadingAuth || loadingSubjects) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!user) {
    navigate("/signin");
    return null;
  }

  function onStudy(chapter: Chapter, pass: number) {
    navigate(`/study/${chapter.id}?pass=${pass}`);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="max-w-5xl mx-auto px-6 pt-10 pb-2">
        <h1 className="text-foreground text-3xl sm:text-4xl font-bold tracking-tight">
          Recall Master.
        </h1>
        <p className="mt-2 text-muted-foreground max-w-2xl leading-relaxed">
          {description ?? "A laboratory for memory. Four progressive passes (match, choose, recall, write) until the answer is yours."}
        </p>
      </header>

      <div className="max-w-5xl mx-auto px-6 mt-6">
        <div className="flex gap-2">
          {subjects.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSubject(s.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-200",
                subject?.id === s.id
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "bg-card text-muted-foreground border border-border hover:border-primary/40 hover:text-foreground",
              )}
            >
              <span>{s.emoji}</span>
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-6">
        <div className="grid md:grid-cols-2 gap-4">
          {(subject?.sections ?? []).map((section, i) => (
            <div
              key={section.id}
              className="animate-slide-up"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <SectionCard
                subject={subject!}
                section={section}
                onStudy={onStudy}
              />
            </div>
          ))}
        </div>

        <div className="mt-6">
          <TwoSiderLauncher />
        </div>
      </main>
    </div>
  );
}
