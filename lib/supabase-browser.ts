import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./auth-env";

let client: SupabaseClient | null | undefined;

export const getSupabaseBrowserClient = (): SupabaseClient | null => {
  if (client !== undefined) return client;
  const config = getSupabaseConfig();
  client = config ? createBrowserClient(config.url, config.anonKey) : null;
  return client;
};
