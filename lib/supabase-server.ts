import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./auth-env";

export type AuthenticatedSupabase = { client: SupabaseClient; userId: string };

export const authenticatedSupabase = async (request: Request): Promise<AuthenticatedSupabase | { error: "not_configured" | "unauthorized" }> => {
  const config = getSupabaseConfig();
  if (!config) return { error: "not_configured" };
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) return { error: "unauthorized" };
  const client = createClient(config.url, config.anonKey, { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await client.auth.getUser(token);
  return error || !data.user ? { error: "unauthorized" } : { client, userId: data.user.id };
};
