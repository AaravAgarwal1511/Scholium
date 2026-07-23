import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAnalytics } from "@repo/analytics";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Upload, Sparkles } from "lucide-react";
import { toast } from "sonner";

const CreateSet = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { track } = useAnalytics();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("french");
  const [vocabularyText, setVocabularyText] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ term: string; definition: string }[]>([]);

  const parseVocabulary = (text: string) => {
    const lines = text.split("\n").filter((line) => line.trim());
    const parsed = lines
      .map((line) => {
        const separators = [" : ", ": ", " :", ":", " - ", "- ", " -", "-", " = ", "= ", " =", "="];
        for (const sep of separators) {
          if (line.includes(sep)) {
            const [term, ...rest] = line.split(sep);
            const definition = rest.join(sep);
            if (term?.trim() && definition?.trim()) {
              return { term: term.trim(), definition: definition.trim() };
            }
          }
        }
        return null;
      })
      .filter(Boolean) as { term: string; definition: string }[];
    return parsed;
  };

  const handleTextChange = (text: string) => {
    setVocabularyText(text);
    setPreview(parseVocabulary(text));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter a set name");
      return;
    }

    const items = parseVocabulary(vocabularyText);
    if (items.length === 0) {
      toast.error("Please add at least one vocabulary item (Term : Definition)");
      return;
    }

    setLoading(true);

    try {
      // Create the vocabulary set
      const { data: setData, error: setError } = await supabase
        .from("vocabulary_sets")
        .insert({ name: name.trim(), description: description.trim() || null, language, user_id: user?.id })
        .select()
        .single();

      if (setError) throw setError;

      // Create vocabulary items
      const { error: itemsError } = await supabase
        .from("vocabulary_items")
        .insert(items.map((item) => ({ set_id: setData.id, term: item.term, definition: item.definition })));

      if (itemsError) throw itemsError;

      track("set_created", { cards: items.length });
      toast.success(`Created "${name}" with ${items.length} terms!`);
      navigate("/");
    } catch (error) {
      console.error("Error creating set:", error);
      toast.error("Failed to create vocabulary set");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto max-w-3xl px-6 py-4">
          <div className="flex items-center gap-4 animate-slide-up">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold font-display">Create Vocabulary Set</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto max-w-3xl px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="shadow-card animate-slide-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-accent" />
                Set Details
              </CardTitle>
              <CardDescription>
                Give your vocabulary set a name and optional description
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Set Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., French Food Vocabulary"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  placeholder="e.g., Common foods and drinks in French"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="language">Language</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger id="language">
                    <SelectValue placeholder="Select language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="french">🇫🇷 French</SelectItem>
                    <SelectItem value="spanish">🇪🇸 Spanish</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card animate-slide-up">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                Vocabulary Items
              </CardTitle>
              <CardDescription>
                Paste your vocabulary in the format: <code className="bg-muted px-1 py-0.5 rounded text-sm">Term : Definition</code>
                <br />
                One pair per line. Supports : - = as separators.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="vocabulary">Vocabulary *</Label>
                <Textarea
                  id="vocabulary"
                  placeholder={`le pain : bread
le fromage : cheese
le vin : wine
la pomme : apple
le café : coffee`}
                  value={vocabularyText}
                  onChange={(e) => handleTextChange(e.target.value)}
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>

              {preview.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-success">Preview ({preview.length} terms detected)</Label>
                  <div className="bg-muted/50 rounded-lg p-4 max-h-[200px] overflow-y-auto">
                    <div className="grid gap-2">
                      {preview.slice(0, 10).map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 text-sm bg-card rounded-md px-3 py-2"
                        >
                          <span className="font-semibold text-primary">{item.term}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="text-foreground">{item.definition}</span>
                        </div>
                      ))}
                      {preview.length > 10 && (
                        <p className="text-sm text-muted-foreground text-center py-2">
                          ... and {preview.length - 10} more
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-4 animate-slide-up">
            <Link to="/" className="flex-1">
              <Button variant="outline" type="button" className="w-full">
                Cancel
              </Button>
            </Link>
            <Button
              type="submit"
              variant="hero"
              className="flex-1"
              disabled={loading || preview.length === 0}
            >
              {loading ? "Creating..." : `Create Set (${preview.length} terms)`}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
};

export default CreateSet;
