// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isPlaceholder(value: string) {
  return value.includes("votre_") || value.includes("example") || value.includes("placeholder");
}

function requireSupabaseConfig(value: string | undefined, name: string) {
  if (!value || !value.trim()) {
    throw new Error(`Missing Supabase environment variable: ${name}`);
  }
  if (isPlaceholder(value)) {
    throw new Error(`Invalid Supabase environment variable: ${name}`);
  }
  return value;
}

export const supabase = createClient(
  requireSupabaseConfig(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"),
  requireSupabaseConfig(supabaseAnonKey, "NEXT_PUBLIC_SUPABASE_ANON_KEY")
);