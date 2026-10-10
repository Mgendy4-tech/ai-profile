export type SupabaseConfig = { url: string; anonKey: string };

const nonEmpty = (value: string | undefined): string => typeof value === "string" ? value.trim() : "";

export const getSupabaseConfig = (): SupabaseConfig | null => {
  const url = nonEmpty(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = nonEmpty(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  return url && anonKey ? { url, anonKey } : null;
};

export const authSetupMessage = "Cloud sync is not configured for this Preview yet. A developer must add the Supabase Preview environment variables and schema.";
