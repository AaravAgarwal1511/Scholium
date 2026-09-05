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
