import { NextResponse } from "next/server";
import { authenticatedSupabase } from "@/lib/supabase-server";
import { cloudProfileFromLocal, type CloudProfileRecord, type CloudWorkspaceDocument, type CloudWorkspacePayload } from "@/lib/cloud-workspace";

const safeError = (code: "not_configured" | "unauthorized" | "cloud_unavailable" | "invalid_payload") => NextResponse.json({ ok: false, code }, { status: code === "unauthorized" ? 401 : code === "not_configured" ? 503 : 400 });

const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const isPayload = (value: unknown): value is CloudWorkspacePayload => {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.profiles)) return false;
  return value.profiles.every((profile) => isRecord(profile) && typeof profile.profileId === "string" && typeof profile.displayName === "string");
};

const rowToProfile = (row: Record<string, unknown>): CloudProfileRecord => ({
  profileId: String(row.profile_id ?? ""), displayName: String(row.display_name ?? "New Profile"), createdAt: String(row.created_at ?? new Date().toISOString()), updatedAt: String(row.updated_at ?? new Date().toISOString()),
  companyData: isRecord(row.company_data) ? row.company_data : null, projects: Array.isArray(row.projects) ? row.projects.filter(isRecord) : [], generatedProfile: isRecord(row.generated_profile) ? row.generated_profile : null, profileStructure: isRecord(row.profile_structure) ? row.profile_structure : null,
  selectedFamily: typeof row.selected_family === "string" ? row.selected_family : null, selectedVariant: typeof row.selected_variant === "string" ? row.selected_variant : null, exportDecision: isRecord(row.export_decision) || typeof row.export_decision === "string" ? row.export_decision : null, freshness: isRecord(row.freshness) ? row.freshness : {}, unsupportedAssets: Array.isArray(row.unsupported_assets) ? row.unsupported_assets.filter((item): item is string => typeof item === "string") : [],
});

export async function GET(request: Request) {
  const auth = await authenticatedSupabase(request);
  if ("error" in auth) return safeError(auth.error);
  const workspace = await auth.client.from("cloud_workspaces").select("version, active_profile_id").eq("user_id", auth.userId).maybeSingle();
  if (workspace.error) { console.error("[cloud-workspace-read]", workspace.error); return safeError("cloud_unavailable"); }
  if (!workspace.data) return NextResponse.json({ ok: true, workspace: null });
  const profiles = await auth.client.from("cloud_profiles").select("*").eq("user_id", auth.userId).order("created_at", { ascending: true });
  if (profiles.error) { console.error("[cloud-profile-read]", profiles.error); return safeError("cloud_unavailable"); }
  const document: CloudWorkspaceDocument = { version: Number(workspace.data.version ?? 1), activeProfileId: workspace.data.active_profile_id, profiles: (profiles.data ?? []).map(rowToProfile) };
  return NextResponse.json({ ok: true, workspace: document });
}

export async function PUT(request: Request) {
  const auth = await authenticatedSupabase(request);
  if ("error" in auth) return safeError(auth.error);
  let payload: unknown;
  try { payload = await request.json(); } catch { return safeError("invalid_payload"); }
  if (!isPayload(payload)) return safeError("invalid_payload");
  const now = new Date().toISOString();
  const workspaceWrite = await auth.client.from("cloud_workspaces").upsert({ user_id: auth.userId, version: payload.version, active_profile_id: payload.activeProfileId, updated_at: now }, { onConflict: "user_id" });
  if (workspaceWrite.error) { console.error("[cloud-workspace-write]", workspaceWrite.error); return safeError("cloud_unavailable"); }
  const records = payload.profiles.map((profile) => ({ user_id: auth.userId, profile_id: profile.profileId, display_name: profile.displayName, created_at: profile.createdAt, updated_at: profile.updatedAt, company_data: profile.companyData, projects: profile.projects, generated_profile: profile.generatedProfile, profile_structure: profile.profileStructure, selected_family: profile.selectedFamily, selected_variant: profile.selectedVariant, export_decision: profile.exportDecision, freshness: profile.freshness, unsupported_assets: profile.unsupportedAssets }));
  if (records.length) {
    const profileWrite = await auth.client.from("cloud_profiles").upsert(records, { onConflict: "user_id,profile_id" });
    if (profileWrite.error) { console.error("[cloud-profile-write]", profileWrite.error); return safeError("cloud_unavailable"); }
  }
  const current = await auth.client.from("cloud_profiles").select("profile_id").eq("user_id", auth.userId);
  if (current.error) { console.error("[cloud-profile-list]", current.error); return safeError("cloud_unavailable"); }
  const desired = new Set(payload.profiles.map((profile) => profile.profileId));
  for (const row of current.data ?? []) if (typeof row.profile_id === "string" && !desired.has(row.profile_id)) {
    const deleted = await auth.client.from("cloud_profiles").delete().eq("user_id", auth.userId).eq("profile_id", row.profile_id);
    if (deleted.error) { console.error("[cloud-profile-delete]", deleted.error); return safeError("cloud_unavailable"); }
  }
  return NextResponse.json({ ok: true, warnings: payload.profiles.flatMap((profile) => profile.unsupportedAssets.map((asset) => `${profile.profileId}:${asset}`)) });
}
