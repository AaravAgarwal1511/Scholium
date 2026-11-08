import { supabase } from "@/integrations/supabase/client";

export interface NewSetItem {
  term: string;
  definition: string;
}

export interface CreateSetInput {
  name: string;
  description?: string | null;
  language: string;
  /** Owner, when signed in. Nullable to match the column and legacy rows. */
  userId?: string | null;
  folderId?: string | null;
  items: NewSetItem[];
}

/**
 * Insert a vocabulary set plus its items in the two round trips this app has
 * always used (set first, then items keyed on the returned id). Shared by the
 * manual "Create Set" form and the one-click starter-set import so the two
 * cannot drift. Throws on either insert failing; returns the new set's id.
 */
export async function createSetWithItems({
  name,
  description = null,
  language,
  userId = null,
  folderId = null,
  items,
}: CreateSetInput): Promise<string> {
  const { data: setData, error: setError } = await supabase
    .from("vocabulary_sets")
    .insert({ name, description, language, user_id: userId, folder_id: folderId })
    .select()
    .single();

  if (setError) throw setError;

  const { error: itemsError } = await supabase
    .from("vocabulary_items")
    .insert(items.map((item) => ({ set_id: setData.id, term: item.term, definition: item.definition })));

  if (itemsError) throw itemsError;

  return setData.id;
}

/** A set can only be split once it is bigger than this. */
export const SPLIT_MIN_TERMS = 30;

/** Fisher–Yates shuffle into a new array. `random` is injectable for tests. */
function shuffled<T>(list: readonly T[], random: () => number): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Randomly deal `items` into `parts` groups whose sizes differ by at most one
 * (the first `items.length % parts` groups get the extra term). Every item lands
 * in exactly one group; the input is not mutated.
 */
export function splitItems<T>(items: readonly T[], parts: number, random: () => number = Math.random): T[][] {
  if (!Number.isInteger(parts) || parts < 2 || parts > items.length) {
    throw new RangeError(`Cannot split ${items.length} items into ${parts} parts`);
  }
  const mixed = shuffled(items, random);
  const base = Math.floor(mixed.length / parts);
  const extra = mixed.length % parts;
  const groups: T[][] = [];
  let start = 0;
  for (let i = 0; i < parts; i++) {
    const size = base + (i < extra ? 1 : 0);
    groups.push(mixed.slice(start, start + size));
    start += size;
  }
  return groups;
}

export interface SplitSetInput {
  name: string;
  description?: string | null;
  language: string;
  userId?: string | null;
  items: NewSetItem[];
  parts: number;
}

/**
 * Break a set into `parts` smaller sets named "<name> 1" … "<name> N", all inside a
 * new folder called "<name>". Returns the folder id. If anything fails part-way the
 * rows created so far are removed again (best effort) before the error is rethrown.
 * The original set is left alone — the caller decides whether to delete it.
 */
export async function splitSetIntoFolder({
  name,
  description = null,
  language,
  userId = null,
  items,
  parts,
}: SplitSetInput): Promise<string> {
  const groups = splitItems(items, parts);

  const { data: folder, error: folderError } = await supabase
    .from("folders")
    .insert({ name, description, user_id: userId ?? undefined })
    .select()
    .single();
  if (folderError) throw folderError;

  const createdSetIds: string[] = [];
  try {
    for (let i = 0; i < groups.length; i++) {
      const id = await createSetWithItems({
        name: `${name} ${i + 1}`,
        description,
        language,
        userId,
        folderId: folder.id,
        items: groups[i],
      });
      createdSetIds.push(id);
    }
  } catch (error) {
    // Items cascade with their set; the folder delete is the final step.
    if (createdSetIds.length) await supabase.from("vocabulary_sets").delete().in("id", createdSetIds);
    await supabase.from("folders").delete().eq("id", folder.id);
    throw error;
  }

  return folder.id;
}
