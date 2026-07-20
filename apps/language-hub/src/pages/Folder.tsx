import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { SetCard } from "@/components/SetCard";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Dumbbell, FolderOpen, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

interface VocabularySet {
  id: string;
  name: string;
  description: string | null;
  language: string;
  folder_id: string | null;
  item_count: number;
  progress: number;
}

interface Folder {
  id: string;
  name: string;
  description: string | null;
}

const FolderPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [folder, setFolder] = useState<Folder | null>(null);
  const [sets, setSets] = useState<VocabularySet[]>([]);
  const [availableSets, setAvailableSets] = useState<VocabularySet[]>([]);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (id) fetchData();
  }, [id]);

  const enrichSets = async (rawSets: any[]): Promise<VocabularySet[]> => {
    return Promise.all(
      rawSets.map(async (set) => {
        const { count: itemCount } = await supabase
          .from("vocabulary_items")
          .select("*", { count: "exact", head: true })
          .eq("set_id", set.id);
        const { count: masteredCount } = await supabase
          .from("set_progress")
          .select("*", { count: "exact", head: true })
          .eq("set_id", set.id)
          .eq("mastered", true);
        return {
          ...set,
          item_count: itemCount || 0,
          progress: itemCount ? Math.round(((masteredCount || 0) / itemCount) * 100) : 0,
        };
      }),
    );
  };

  const fetchData = async () => {
    try {
      const { data: folderData, error: folderError } = await supabase
        .from("folders")
        .select("*")
        .eq("id", id)
        .single();

      if (folderError) throw folderError;
      setFolder(folderData);
      setEditName(folderData.name);
      setEditDescription(folderData.description || "");

      const { data: setsData, error: setsError } = await supabase
        .from("vocabulary_sets")
        .select("*")
        .eq("folder_id", id)
        .order("created_at", { ascending: false });

      if (setsError) throw setsError;
      setSets(await enrichSets(setsData || []));
    } catch (error) {
      console.error("Error fetching folder:", error);
      toast.error("Failed to load folder");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableSets = async () => {
    const { data, error } = await supabase
      .from("vocabulary_sets")
      .select("*")
      .is("folder_id", null)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load sets");
      return;
    }
    setAvailableSets(await enrichSets(data || []));
    setSelectedSetIds(new Set());
  };

  const openAddDialog = async () => {
    await fetchAvailableSets();
    setAddOpen(true);
  };

  const toggleSelected = (setId: string) => {
    setSelectedSetIds((prev) => {
      const next = new Set(prev);
      if (next.has(setId)) next.delete(setId);
      else next.add(setId);
      return next;
    });
  };

  const addSelectedSets = async () => {
    if (selectedSetIds.size === 0) {
      setAddOpen(false);
      return;
    }
    const ids = Array.from(selectedSetIds);
    const { error } = await supabase
      .from("vocabulary_sets")
      .update({ folder_id: id })
      .in("id", ids);

    if (error) {
      toast.error("Failed to add sets");
      return;
    }
    toast.success(`Added ${ids.length} set${ids.length === 1 ? "" : "s"} to folder`);
    setAddOpen(false);
    fetchData();
  };

  const removeSet = async (setId: string) => {
    const { error } = await supabase
      .from("vocabulary_sets")
      .update({ folder_id: null })
      .eq("id", setId);

    if (error) {
      toast.error("Failed to remove set");
      return;
    }
    toast.success("Removed from folder");
    setSets((prev) => prev.filter((s) => s.id !== setId));
  };

  const saveEdit = async () => {
    if (!editName.trim()) {
      toast.error("Folder name is required");
      return;
    }
    const { error } = await supabase
      .from("folders")
      .update({
        name: editName.trim(),
        description: editDescription.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update folder");
      return;
    }
    setFolder((prev) => (prev ? { ...prev, name: editName.trim(), description: editDescription.trim() || null } : prev));
    setEditOpen(false);
    toast.success("Folder updated");
  };

  const deleteFolder = async () => {
    const { error } = await supabase.from("folders").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete folder");
      return;
    }
    toast.success("Folder deleted, sets preserved");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!folder) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto max-w-4xl px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-6 w-6 text-accent" />
                <div>
                  <h1 className="text-xl font-bold font-display">{folder.name}</h1>
                  {folder.description && (
                    <p className="text-sm text-muted-foreground">{folder.description}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to={`/practice-setup?folder=${id}`}>
                <Button variant="accent" size="sm">
                  <Dumbbell className="mr-2 h-4 w-4" />
                  Practice
                </Button>
              </Link>
              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Folder</DialogTitle>
                    <DialogDescription>Rename this folder or update its description.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="folder-name">Name</Label>
                      <Input
                        id="folder-name"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="folder-description">Description (optional)</Label>
                      <Input
                        id="folder-description"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                    <Button onClick={saveEdit}>Save</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this folder?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The folder "{folder.name}" will be deleted. The sets inside it will not be deleted, they will become uncategorized.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={deleteFolder}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-4xl px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-foreground font-display">Sets in this Folder</h2>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button variant="accent" onClick={openAddDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Sets
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Sets to Folder</DialogTitle>
                <DialogDescription>
                  Select uncategorized sets to add to "{folder.name}".
                </DialogDescription>
              </DialogHeader>
              {availableSets.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No uncategorized sets available. Remove a set from another folder first.
                </p>
              ) : (
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {availableSets.map((set) => (
                    <label
                      key={set.id}
                      className="flex items-center gap-3 p-3 rounded-md border border-border hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedSetIds.has(set.id)}
                        onCheckedChange={() => toggleSelected(set.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{set.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {set.item_count} terms · {set.language === "spanish" ? "🇪🇸" : "🇫🇷"}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button onClick={addSelectedSets} disabled={selectedSetIds.size === 0}>
                  Add {selectedSetIds.size > 0 ? `(${selectedSetIds.size})` : ""}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {sets.length === 0 ? (
          <Card className="text-center py-16 shadow-card">
            <CardContent>
              <FolderOpen className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">This folder is empty</h3>
              <p className="text-muted-foreground mb-6">Add sets to organize them together.</p>
              <Button variant="hero" onClick={openAddDialog}>
                <Plus className="mr-2 h-4 w-4" />
                Add Sets
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {sets.map((set) => (
              <SetCard
                key={set.id}
                set={set}
                action={
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSet(set.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Remove from folder"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default FolderPage;
