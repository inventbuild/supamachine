import { createClient } from "@supabase/supabase-js";

const url = "YOUR_SUPABASE_URL";
const anonKey = "YOUR_SUPABASE_ANON_KEY";

if (!url || !anonKey) {
  throw new Error("Missing Supabase env vars");
}

export const supabase = createClient(url, anonKey);
