import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Private Storage bucket holding the note PDFs. Its RLS policy admits only the
// `authenticated` role (see database/migrations/*_notes_storage.sql), so every
// read here needs a live session and PDFs reach the browser as signed URLs —
// the login requirement is enforced by the bucket, not just by a route guard.
export const NOTES_BUCKET = "notes";
