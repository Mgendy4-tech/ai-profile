import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./supabase-browser";
import { activeWorkspaceProfile, readWorkspace, type Workspace, type WorkspaceProfile } from "./workspace";
import { reportClientFailure } from "./client-observability";
import { clearTrustedHydratedCloudAssets, inferTrustedCloudAssetKind, isOwnedCloudAssetPath, registerTrustedHydratedCloudAsset } from "./cloud-asset-trust";

export const CUSTOMER_ASSETS_BUCKET = "customer-assets";
export type CloudAssetKind = "logo" | "project";
export type CloudAssetResult = { ok: true; path: string } | { ok: false; code: "not_configured" | "unauthorized" | "upload_failed" | "invalid_asset" };

const isDataImage = (value: unknown): value is string => typeof value === "string" && /^data:image\/(png|jpeg);base64,/i.test(value);
const extensionFor = (dataUrl: string): "png" | "jpg" => /^data:image\/png/i.test(dataUrl) ? "png" : "jpg";
const parseDataUrl = (dataUrl: string): { blob: Blob; extension: "png" | "jpg" } | null => {
  if (!isDataImage(dataUrl)) return null;
  const [header, encoded] = dataUrl.split(",", 2);
  if (!header || !encoded) return null;
  try {
    const binary = atob(encoded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return { blob: new Blob([bytes], { type: header.slice(5, header.indexOf(";")) }), extension: extensionFor(dataUrl) };
  } catch { return null; }
};

const currentUser = async (client: SupabaseClient): Promise<string | null> => {
  try {
    const { data } = await client.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    reportClientFailure({ category: "auth_failure", code: "asset_session_lookup_failed", surface: "storage" });
    return null;
  }
};

export { clearTrustedHydratedCloudAssets } from "./cloud-asset-trust";

export const isOwnedAssetPath = isOwnedCloudAssetPath;

export const uploadCloudAsset = async (profileId: string, kind: CloudAssetKind, dataUrl: string, client = getSupabaseBrowserClient()): Promise<CloudAssetResult> => {
  if (!client) return { ok: false, code: "not_configured" };
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return { ok: false, code: "invalid_asset" };
  const userId = await currentUser(client);
  if (!userId) return { ok: false, code: "unauthorized" };
  const path = `${userId}/${profileId}/${kind}-${crypto.randomUUID()}.${parsed.extension}`;
  try {
    const upload = await client.storage.from(CUSTOMER_ASSETS_BUCKET).upload(path, parsed.blob, { contentType: parsed.blob.type, upsert: false });
    if (upload.error) { reportClientFailure({ category: "storage_upload_failure", code: "asset_upload_failed", surface: kind }); return { ok: false, code: "upload_failed" }; }
    return { ok: true, path };
  } catch {
    reportClientFailure({ category: "storage_upload_failure", code: "asset_upload_failed", surface: kind });
    return { ok: false, code: "upload_failed" };
  }
};

export const removeCloudAsset = async (path: string | undefined, profileId: string, client = getSupabaseBrowserClient()): Promise<boolean> => {
  if (!client) return false;
  const userId = await currentUser(client);
  if (!userId || !isOwnedAssetPath(path, userId, profileId)) return false;
  try {
    const result = await client.storage.from(CUSTOMER_ASSETS_BUCKET).remove([path]);
    if (result.error) reportClientFailure({ category: "storage_upload_failure", code: "asset_remove_failed", surface: "asset_delete" });
    return !result.error;
  } catch {
    reportClientFailure({ category: "storage_upload_failure", code: "asset_remove_failed", surface: "asset_delete" });
    return false;
  }
};

export const removeProfileCloudAssets = async (profile: WorkspaceProfile, client = getSupabaseBrowserClient()): Promise<number> => {
  if (!client) return 0;
  const userId = await currentUser(client);
  if (!userId) return 0;
  const paths: string[] = [];
  const company = parseObject(profile.state.companyData);
  if (typeof company?.logoPath === "string" && isOwnedAssetPath(company.logoPath, userId, profile.id)) paths.push(company.logoPath);
  for (const project of parseArray(profile.state.projectsData)) if (typeof project.imagePath === "string" && isOwnedAssetPath(project.imagePath, userId, profile.id)) paths.push(project.imagePath);
  if (!paths.length) return 0;
  try {
    const result = await client.storage.from(CUSTOMER_ASSETS_BUCKET).remove([...new Set(paths)]);
    if (result.error) reportClientFailure({ category: "storage_upload_failure", code: "profile_asset_cleanup_failed", surface: "profile_delete" });
    return result.error ? 0 : new Set(paths).size;
  } catch {
    reportClientFailure({ category: "storage_upload_failure", code: "profile_asset_cleanup_failed", surface: "profile_delete" });
    return 0;
  }
};

export const hydrateCloudAsset = async (path: string | undefined, profileId: string, client = getSupabaseBrowserClient(), kind: CloudAssetKind = (path ? inferTrustedCloudAssetKind(path) ?? "project" : "project")): Promise<string> => {
  if (!client) return "";
  const userId = await currentUser(client);
  if (!userId || !isOwnedAssetPath(path, userId, profileId)) return "";
  let signed: { data: { signedUrl?: string } | null; error: unknown };
  try { signed = await client.storage.from(CUSTOMER_ASSETS_BUCKET).createSignedUrl(path, 300); } catch { reportClientFailure({ category: "storage_hydration_failure", code: "signed_url_failed", surface: "asset_hydration" }); return ""; }
  if (signed.error || !signed.data?.signedUrl) { reportClientFailure({ category: "storage_hydration_failure", code: "signed_url_failed", surface: "asset_hydration" }); return ""; }
  if (!registerTrustedHydratedCloudAsset(signed.data.signedUrl, path, userId, profileId, kind)) {
    reportClientFailure({ category: "storage_hydration_failure", code: "signed_url_untrusted", surface: "asset_hydration" });
    return "";
  }
  // A private signed URL is already a browser-safe image source. Downloading
  // it with fetch adds a CORS dependency that is unnecessary for <img> and
  // caused fresh-session hydration to fail while cloud sync still succeeded.
  return signed.data.signedUrl;
};

const needsAssetHydration = (value: unknown): boolean => typeof value !== "string" || !value || /^https?:\/\/.*\/storage\/v1\/object\/sign\/customer-assets\//i.test(value);

const parseObject = (raw: string | undefined): Record<string, unknown> | null => {
  if (!raw) return null;
  try { const value = JSON.parse(raw); return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; } catch { return null; }
};
const parseArray = (raw: string | undefined): Array<Record<string, unknown>> => {
  if (!raw) return [];
  try { const value = JSON.parse(raw); return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object" && !Array.isArray(item))) : []; } catch { return []; }
};

export const hydrateWorkspaceAssets = async (workspace: Workspace, client = getSupabaseBrowserClient()): Promise<Workspace> => {
  if (!client) return workspace;
  const next: Workspace = { ...workspace, profiles: workspace.profiles.map((profile) => ({ ...profile, state: { ...profile.state } })) };
  for (const profile of next.profiles) {
    const company = parseObject(profile.state.companyData);
    if (company?.logoPath && needsAssetHydration(company.logoUrl)) {
      const logo = await hydrateCloudAsset(String(company.logoPath), profile.id, client, "logo");
      if (logo) company.logoUrl = logo;
    }
    if (company) profile.state.companyData = JSON.stringify(company);
    const projects = parseArray(profile.state.projectsData);
    for (const project of projects) if (project.imagePath && needsAssetHydration(project.imageUrl)) {
      const image = await hydrateCloudAsset(String(project.imagePath), profile.id, client, "project");
      if (image) project.imageUrl = image;
    }
    if (projects.length) profile.state.projectsData = JSON.stringify(projects);
    const generated = parseObject(profile.state.generatedProfile);
    if (generated) {
    const generatedCompany = generated.logoPath && needsAssetHydration(generated.logoUrl) ? await hydrateCloudAsset(String(generated.logoPath), profile.id, client, "logo") : "";
      if (generatedCompany) generated.logoUrl = generatedCompany;
      if (Array.isArray(generated.projects)) for (const project of generated.projects) if (project && typeof project === "object" && (project as Record<string, unknown>).imagePath && needsAssetHydration((project as Record<string, unknown>).imageUrl)) {
        const item = project as Record<string, unknown>;
        const image = await hydrateCloudAsset(String(item.imagePath), profile.id, client, "project");
        if (image) item.imageUrl = image;
      }
      profile.state.generatedProfile = JSON.stringify(generated);
    }
  }
  return next;
};

export const migrateLocalWorkspaceAssets = async (workspace: Workspace, client = getSupabaseBrowserClient()): Promise<{ workspace: Workspace; uploaded: number; failed: number }> => {
  if (!client) return { workspace, uploaded: 0, failed: 0 };
  const next: Workspace = { ...workspace, profiles: workspace.profiles.map((profile) => ({ ...profile, state: { ...profile.state } })) };
  let uploaded = 0;
  let failed = 0;
  for (const profile of next.profiles) {
    const company = parseObject(profile.state.companyData);
    if (company && isDataImage(company.logoUrl) && !company.logoPath) {
      const result = await uploadCloudAsset(profile.id, "logo", company.logoUrl, client);
      if (result.ok) { company.logoPath = result.path; uploaded += 1; } else failed += 1;
    }
    if (company) profile.state.companyData = JSON.stringify(company);
    const projects = parseArray(profile.state.projectsData);
    for (const project of projects) if (isDataImage(project.imageUrl) && !project.imagePath) {
      const result = await uploadCloudAsset(profile.id, "project", project.imageUrl, client);
      if (result.ok) { project.imagePath = result.path; uploaded += 1; } else failed += 1;
    }
    if (projects.length) profile.state.projectsData = JSON.stringify(projects);
    const generated = parseObject(profile.state.generatedProfile);
    if (generated) {
      if (isDataImage(generated.logoUrl) && !generated.logoPath && company?.logoPath) generated.logoPath = company.logoPath;
      if (Array.isArray(generated.projects)) for (const project of generated.projects) if (project && typeof project === "object") {
        const item = project as Record<string, unknown>;
        const source = projects.find((candidate) => candidate.id === item.id || candidate.name === item.name);
        if (source?.imagePath && !item.imagePath) item.imagePath = source.imagePath;
      }
      profile.state.generatedProfile = JSON.stringify(generated);
    }
  }
  return { workspace: next, uploaded, failed };
};

export const activeProfileAssetPath = (storage: Storage): string => activeWorkspaceProfile(readWorkspace(storage)).id;
