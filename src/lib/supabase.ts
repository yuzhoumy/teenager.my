import { createClient, type User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient<Database>(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-anon-key"
);

let userPromise: Promise<User | null> | null = null;

export async function getSupabaseUser() {
  if (!isSupabaseConfigured) {
    return null;
  }

  if (!userPromise) {
    userPromise = supabase.auth
      .getSession()
      .then(({ data }) => data.session?.user ?? null)
      .finally(() => {
        userPromise = null;
      });
  }

  return userPromise;
}
