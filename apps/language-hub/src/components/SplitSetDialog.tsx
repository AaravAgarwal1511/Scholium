import { useState } from "react";
import { Scissors } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { splitSetIntoFolder } from "@/lib/sets";

interface SplitSetDialogProps {
  set: { id: string; name: string; description: string | null; language: string };
  /** Current number of terms, used for the size preview and the upper bound. */
  itemCount: number;
  /** Called after a successful split so the page can reload its sets and folders. */
  onSplit: () => void;
}

/** Scissors button + dialog that breaks a set into N randomly-dealt sets inside a new folder. */
export const SplitSetDialog = ({ set, itemCount, onSplit }: SplitSetDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [parts, setParts] = useState("2");
  const [deleteOriginal, setDeleteOriginal] = useState(false);
  const [busy, setBusy] = useState(false);

  const n = Number(parts);
  const valid = Number.isInteger(n) && n >= 2 && n <= itemCount;
  const big = valid ? Math.ceil(itemCount / n) : 0;
  const small = valid ? Math.floor(itemCount / n) : 0;

  const handleSplit = async () => {
    if (!valid) return;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from("vocabulary_items")
        .select("term, definition")
        .eq("set_id", set.id)
        .order("created_at", { ascending: true });
      if (error) throw error;

      await splitSetIntoFolder({
        name: set.name,
        description: set.description,
        language: set.language,
        userId: user?.id ?? null,
        items: data ?? [],
        parts: n,
      });

      if (deleteOriginal) {
        const { error: deleteError } = await supabase.from("vocabulary_sets").delete().eq("id", set.id);
        if (deleteError) throw deleteError;
      }

      toast.success(`Split "${set.name}" into ${n} sets in a new folder`);
      setOpen(false);
      onSplit();
    } catch (error) {
      console.error("Error splitting set:", error);
      toast.error("Failed to split vocabulary set");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Split ${set.name}`}
          title="Split into smaller sets"
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity text-muted-foreground hover:text-primary hover:bg-primary/10"
        >
          <Scissors className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Split “{set.name}”</DialogTitle>
          <DialogDescription>
            Its {itemCount} terms are shuffled and dealt out evenly into “{set.name} 1”, “{set.name} 2”, … inside a new folder
            called “{set.name}”.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={`split-parts-${set.id}`}>Number of sets</Label>
          <Input
            id={`split-parts-${set.id}`}
            type="number"
            inputMode="numeric"
            min={2}
            max={itemCount}
            value={parts}
            onChange={(e) => setParts(e.target.value)}
            className="w-32"
          />
          {valid ? (
            <p className="text-sm text-muted-foreground">
              {n} sets of {small === big ? big : `${small}–${big}`} terms each
            </p>
          ) : (
            <p className="text-sm text-destructive">Enter a whole number from 2 to {itemCount}.</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`split-delete-${set.id}`}
            checked={deleteOriginal}
            onCheckedChange={(checked) => setDeleteOriginal(checked === true)}
          />
          <Label htmlFor={`split-delete-${set.id}`} className="font-normal">
            Delete the original set after splitting
          </Label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleSplit} disabled={!valid || busy}>
            {busy ? "Splitting..." : "Split into folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
