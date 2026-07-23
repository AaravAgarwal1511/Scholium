import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Pencil, Loader2 } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

/** Pure — depends only on its argument, so it lives outside the component and
 *  stays referentially stable for the memoised fetch below. */
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

const EditSet = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [language, setLanguage] = useState("french");
    const [folderId, setFolderId] = useState<string>("none");
    const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
    const [vocabularyText, setVocabularyText] = useState("");
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [preview, setPreview] = useState<{ term: string; definition: string }[]>([]);

    const fetchSet = useCallback(async () => {
        try {
            // Fetch the set
            const { data: setData, error: setError } = await supabase
                .from("vocabulary_sets")
                .select("*")
                .eq("id", id)
                .single();

            if (setError) throw setError;

            // Fetch items
            const { data: itemsData, error: itemsError } = await supabase
                .from("vocabulary_items")
                .select("*")
                .eq("set_id", id)
                .order("created_at", { ascending: true });

            if (itemsError) throw itemsError;

            setName(setData.name);
            setDescription(setData.description || "");
            setLanguage(setData.language || "french");
            setFolderId(setData.folder_id || "none");

            // Folders table may not exist yet (pre-migration). Silently treat as empty.
            try {
                const { data: foldersData } = await supabase
                    .from("folders")
                    .select("id, name")
                    .order("name");
                setFolders(foldersData || []);
            } catch {
                setFolders([]);
            }

            // Rebuild the text from items
            const text = (itemsData || []).map((item) => `${item.term} : ${item.definition}`).join("\n");
            setVocabularyText(text);
            setPreview(parseVocabulary(text));
        } catch (error) {
            console.error("Error fetching set:", error);
            toast.error("Failed to load vocabulary set");
            navigate("/");
        } finally {
            setFetching(false);
        }
    }, [id, navigate]);

    useEffect(() => {
        if (id) fetchSet();
    }, [id, fetchSet]);

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
            // Update the vocabulary set
            const { error: setError } = await supabase
                .from("vocabulary_sets")
                .update({
                    name: name.trim(),
                    description: description.trim() || null,
                    language,
                    folder_id: folderId === "none" ? null : folderId,
                })
                .eq("id", id);

            if (setError) throw setError;

            // Delete existing items
            const { error: deleteError } = await supabase
                .from("vocabulary_items")
                .delete()
                .eq("set_id", id);

            if (deleteError) throw deleteError;

            // Insert new items
            const { error: itemsError } = await supabase
                .from("vocabulary_items")
                .insert(items.map((item) => ({ set_id: id!, term: item.term, definition: item.definition })));

            if (itemsError) throw itemsError;

            toast.success(`Updated "${name}" with ${items.length} terms!`);
            navigate("/");
        } catch (error) {
            console.error("Error updating set:", error);
            toast.error("Failed to update vocabulary set");
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

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
                        <h1 className="text-xl font-bold font-display">Edit Vocabulary Set</h1>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto max-w-3xl px-6 py-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <Card className="shadow-card animate-slide-up" style={{ animationDelay: "0ms" }}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Pencil className="h-5 w-5 text-accent" />
                                Set Details
                            </CardTitle>
                            <CardDescription>
                                Update your vocabulary set name and description
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
                            <div className="space-y-2">
                                <Label htmlFor="folder">Folder</Label>
                                <Select value={folderId} onValueChange={setFolderId}>
                                    <SelectTrigger id="folder">
                                        <SelectValue placeholder="No folder" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">No folder (uncategorized)</SelectItem>
                                        {folders.map((folder) => (
                                            <SelectItem key={folder.id} value={folder.id}>
                                                {folder.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-card animate-slide-up" style={{ animationDelay: "0ms" }}>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Pencil className="h-5 w-5 text-primary" />
                                Vocabulary Items
                            </CardTitle>
                            <CardDescription>
                                Edit your vocabulary in the format: <code className="bg-muted px-1 py-0.5 rounded text-sm">Term : Definition</code>
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

                    <div className="flex flex-col sm:flex-row gap-4 animate-slide-up" style={{ animationDelay: "0ms" }}>
                        <div className="flex gap-4 flex-1">
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
                                {loading ? "Saving..." : `Save Changes (${preview.length} terms)`}
                            </Button>
                        </div>

                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" type="button" className="text-destructive hover:bg-destructive/10">
                                    Delete Set
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure you want to delete this set?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete the vocabulary set "{name}" and all its contents.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={async () => {
                                            try {
                                                const { error } = await supabase.from("vocabulary_sets").delete().eq("id", id);
                                                if (error) throw error;
                                                toast.success("Set deleted successfully");
                                                navigate("/");
                                            } catch (error) {
                                                console.error("Error deleting set:", error);
                                                toast.error("Failed to delete set");
                                            }
                                        }}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                        Delete
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </form>
            </main>
        </div>
    );
};

export default EditSet;
