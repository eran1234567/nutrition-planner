// Runtime-safe backend client wrapper.
// We keep this separate from the auto-generated client file so we can add
// fallbacks without editing generated code.

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// These are public values (URL + anon key). We still prefer env vars,
// but we provide a safe fallback to prevent blank-screen crashes.
const FALLBACK_URL = "https://thgtxxqrqrqdknfbwoca.supabase.co";
const FALLBACK_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZ3R4eHFycXJxZGtuZmJ3b2NhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwNTU2MjAsImV4cCI6MjA4NTYzMTYyMH0.Hq_oxpsEj1oVJcPZ0NNSSADAfFkSyufC26jRLMjJ-gA";

const env = import.meta.env as any;

const SUPABASE_URL: string = env.VITE_SUPABASE_URL || env.SUPABASE_URL || FALLBACK_URL;

const SUPABASE_ANON_KEY: string =
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  env.VITE_SUPABASE_ANON_KEY ||
  env.SUPABASE_ANON_KEY ||
  FALLBACK_ANON_KEY;

if (!env.VITE_SUPABASE_URL) {
  console.warn("[backend] VITE_SUPABASE_URL missing at runtime; using fallback URL.");
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});
