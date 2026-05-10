import { createClient } from "@supabase/supabase-js";

const cleanEnv = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const supabaseUrl = cleanEnv(import.meta.env.VITE_SUPABASE_URL) ?? cleanEnv(import.meta.env.EXPO_PUBLIC_SUPABASE_URL);
const supabaseAnonKey =
  cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY) ?? cleanEnv(import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in zentra-main/.env, then restart npm run dev.",
  );
}

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient(supabaseUrl || "https://missing-supabase-url.invalid", supabaseAnonKey || "missing-key", {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
