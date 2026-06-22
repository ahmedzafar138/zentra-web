import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const cleanEnv = (value: unknown) =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;

const supabaseUrl =
  cleanEnv(import.meta.env.VITE_SUPABASE_URL) ??
  (typeof process !== "undefined" ? cleanEnv(process.env.SUPABASE_URL) : undefined);

const supabaseAnonKey =
  cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY) ??
  cleanEnv(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) ??
  (typeof process !== "undefined" ? cleanEnv(process.env.SUPABASE_PUBLISHABLE_KEY) : undefined);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then restart npm run dev.",
  );
} else if (typeof window !== "undefined") {
  // Visible diagnostic so it's easy to confirm the right URL was baked in at dev-server startup.
  console.info(`[Supabase] using ${supabaseUrl}`);
}

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
export const SUPABASE_URL = supabaseUrl;

export const supabase = createClient<Database>(
  supabaseUrl || "https://missing-supabase-url.invalid",
  supabaseAnonKey || "missing-key",
  {
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  },
);

/**
 * Translate a Supabase / fetch error into a message that points at the actual cause.
 *
 * "TypeError: Failed to fetch" is what the browser throws when the request never
 * reached the server — DNS failure, CORS preflight rejection, offline, mixed-content
 * block, or an extension blocking it. The bare message is useless to the user.
 */
export function describeAuthError(err: unknown): string {
  if (!(err instanceof Error)) return "Authentication failed.";
  const message = err.message || "";
  const looksLikeNetwork =
    message === "Failed to fetch" ||
    message === "NetworkError when attempting to fetch resource." ||
    message.toLowerCase().includes("load failed");
  if (!looksLikeNetwork) return message;
  if (!hasSupabaseConfig) {
    return "Supabase env vars are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env, then restart `npm run dev`.";
  }
  return `Could not reach Supabase at ${supabaseUrl}. Likely causes: the dev server has stale env (stop and restart \`npm run dev\`), the project is paused (resume it at supabase.com/dashboard), an ad-blocker / browser extension is blocking the request, or you are offline.`;
}
