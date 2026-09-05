import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAnalytics } from "@repo/analytics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { createSetWithItems } from "@/lib/sets";
import { STARTER_SETS, type StarterSet } from "@/data/starterSets";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";

type LanguageFilter = "all" | "french" | "spanish";

const FILTERS: { value: LanguageFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "french", label: "🇫🇷 French" },
  { value: "spanish", label: "🇪🇸 Spanish" },
];

const PREVIEW_COUNT = 5;

/** Match a starter set to an existing set the same way the user would read it:
 *  same name, same language. Case/space-insensitive so a trivial rename still
 *  counts as "already imported". */
const keyFor = (name: string, language: string) => `${language}:::${name.trim().toLowerCase()}`;

const StarterSets = () => {
  const { user } = useAuth();
  const { track } = useAnalytics();
  const [filter, setFilter] = useState<LanguageFilter>("all");
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("vocabulary_sets")
      .select("name, language")
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .then(({ data }) => {
        if (!cancelled && data) {
          setImportedKeys(new Set(data.map((s) => keyFor(s.name, s.language))));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const visibleSets = useMemo(
    () => (filter === "all" ? STARTER_SETS : STARTER_SETS.filter((s) => s.language === filter)),
    [filter],
  );

  const handleImport = async (starter: StarterSet) => {
    setImportingId(starter.id);
    try {
      await createSetWithItems({
        name: starter.name,
        description: starter.description,
        language: starter.language,
        userId: user?.id ?? null,
        items: starter.items,
      });
      track("starter_set_imported", { starter_id: starter.id, cards: starter.items.length });
      setImportedKeys((prev) => new Set(prev).add(keyFor(starter.name, starter.language)));
      toast.success(`Imported "${starter.name}" — ${starter.items.length} terms added to your sets`);
    } catch (error) {
      console.error("Error importing starter set:", error);
      toast.error("Failed to import set");
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto max-w-4xl px-6 py-4">
          <div className="flex items-center gap-4 animate-slide-up">
            <Link to="/">
              <Button variant="ghost" size="icon" aria-label="Back to dashboard">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold font-display">Starter Sets</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-6 py-8 space-y-6">
        <div className="space-y-1">
          <p className="text-muted-foreground max-w-2xl leading-relaxed">
            Ready-made vocabulary sets to get you going. Import any of them into your own list, then
            study or edit it like a set you built yourself.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap" role="group" aria-label="Filter by language">
          {FILTERS.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? "default" : "outline"}
              size="sm"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {visibleSets.map((starter) => {
            const imported = importedKeys.has(keyFor(starter.name, starter.language));
            const busy = importingId === starter.id;
            return (
              <Card
                key={starter.id}
                data-testid={`starter-set-${starter.id}`}
                className="shadow-card flex flex-col"
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-display">{starter.name}</CardTitle>
                  <CardDescription className="mt-1">{starter.description}</CardDescription>
                  <div className="flex items-center gap-2 flex-wrap mt-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                      {starter.language === "spanish" ? "🇪🇸 Spanish" : "🇫🇷 French"}
                    </span>
                    <span className="text-xs text-muted-foreground">{starter.items.length} terms</span>
                    {imported && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success/15 text-success">
                        <Check className="h-3 w-3" aria-hidden="true" />
                        In your sets
                      </span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 flex-1">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <div className="grid gap-1.5">
                      {starter.items.slice(0, PREVIEW_COUNT).map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 text-sm bg-card rounded-md px-3 py-1.5"
                        >
                          <span className="font-semibold text-primary">{item.term}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-foreground">{item.definition}</span>
                        </div>
                      ))}
                      {starter.items.length > PREVIEW_COUNT && (
                        <p className="text-sm text-muted-foreground text-center py-1">
                          … and {starter.items.length - PREVIEW_COUNT} more
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-auto">
                    <Button
                      onClick={() => handleImport(starter)}
                      disabled={importingId !== null}
                      variant={imported ? "outline" : "default"}
                      className="w-full"
                    >
                      <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                      {busy ? "Importing…" : imported ? "Import again" : "Import set"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
};

export default StarterSets;
