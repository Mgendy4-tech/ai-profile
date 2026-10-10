import { createEmptyWorkspace, type Workspace, type WorkspaceProfile, type WorkspaceProfileState } from "./workspace";

export const CLOUD_OWNER_STORAGE_KEY = "workspaceCloudOwnerId";
export const CLOUD_MIGRATION_PREFIX = "workspaceCloudMigration:";
export const CLOUD_SCHEMA_VERSION = 1;

export type CloudProfileRecord = {
  profileId: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  companyData: Record<string, unknown> | null;
  projects: Array<Record<string, unknown>>;
  generatedProfile: Record<string, unknown> | null;
  profileStructure: Record<string, unknown> | null;
  selectedFamily: string | null;
  selectedVariant: string | null;
  exportDecision: Record<string, unknown> | string | null;
  freshness: Record<string, unknown>;
  unsupportedAssets: string[];
};

export type CloudWorkspacePayload = {
  version: number;
  activeProfileId: string | null;
  profiles: CloudProfileRecord[];
};

export type CloudWorkspaceDocument = CloudWorkspacePayload & { userId?: string };

const parseJson = (raw: string | undefined): unknown => {
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
};

const asRecord = (value: unknown): Record<string, unknown> | null => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
const asArray = (value: unknown): Array<Record<string, unknown>> => Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object" && !Array.isArray(entry))) : [];
const iso = (value: number): string => new Date(Number.isFinite(value) ? value : Date.now()).toISOString();
const timestamp = (value: string): number => { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : Date.now(); };

const stripImagePayloads = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripImagePayloads);
  if (!value || typeof value !== "object") return value;
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) output[key] = typeof item === "string" && /^data:image\//i.test(item) && (key === "imageUrl" || key === "logoUrl") ? "" : stripImagePayloads(item);
  return output;
};

const mergeImagePayloads = (cloud: unknown, local: unknown): unknown => {
  if (Array.isArray(cloud) && Array.isArray(local)) return cloud.map((item, index) => mergeImagePayloads(item, local[index]));
  if (!cloud || typeof cloud !== "object" || !local || typeof local !== "object") return typeof cloud === "string" && !cloud && typeof local === "string" && /^data:image\//i.test(local) ? local : cloud;
  const output: Record<string, unknown> = { ...(cloud as Record<string, unknown>) };
  for (const [key, item] of Object.entries(output)) output[key] = mergeImagePayloads(item, (local as Record<string, unknown>)[key]);
  return output;
};

const unsupportedAssetPaths = (profile: WorkspaceProfile): string[] => {
  const issues: string[] = [];
  const company = asRecord(parseJson(profile.state.companyData));
  if (typeof company?.logoUrl === "string" && company.logoUrl.startsWith("data:image/")) issues.push("company.logoUrl");
  for (const [index, project] of asArray(parseJson(profile.state.projectsData)).entries()) {
    if (typeof project.imageUrl === "string" && project.imageUrl.startsWith("data:image/")) issues.push(`projects.${index}.imageUrl`);
  }
  return issues;
};

export const cloudProfileFromLocal = (profile: WorkspaceProfile): CloudProfileRecord => {
  const generated = asRecord(parseJson(profile.state.generatedProfile));
  const company = asRecord(stripImagePayloads(parseJson(profile.state.companyData)));
  const projects = asArray(stripImagePayloads(parseJson(profile.state.projectsData)));
  return {
    profileId: profile.id,
    displayName: profile.displayName,
    createdAt: iso(profile.createdAt),
    updatedAt: iso(profile.updatedAt),
    companyData: company,
    projects,
    generatedProfile: asRecord(stripImagePayloads(generated)),
    profileStructure: asRecord(parseJson(profile.state.profileStructure)),
    selectedFamily: profile.state.authoredFamilyDecision ?? null,
    selectedVariant: profile.state.authoredVariantDecision ?? null,
    exportDecision: asRecord(parseJson(profile.state.exportDecision)) ?? profile.state.exportDecision ?? null,
    freshness: generated ? { generatedAt: generated.generatedAt ?? null, sourceFingerprint: generated.sourceFingerprint ?? null } : {},
    unsupportedAssets: unsupportedAssetPaths(profile),
  };
};

export const workspaceToCloudPayload = (workspace: Workspace): CloudWorkspacePayload => ({
  version: CLOUD_SCHEMA_VERSION,
  activeProfileId: workspace.activeProfileId,
  profiles: workspace.profiles.map(cloudProfileFromLocal),
});

const safeString = (value: unknown): string | undefined => typeof value === "string" ? value : undefined;
const stateFromCloudProfile = (profile: CloudProfileRecord): WorkspaceProfileState => {
  const state: WorkspaceProfileState = {};
  if (profile.companyData) state.companyData = JSON.stringify(profile.companyData);
  if (profile.projects.length) state.projectsData = JSON.stringify(profile.projects);
  if (profile.generatedProfile) state.generatedProfile = JSON.stringify(profile.generatedProfile);
  if (profile.profileStructure) state.profileStructure = JSON.stringify(profile.profileStructure);
  if (profile.selectedFamily) state.authoredFamilyDecision = profile.selectedFamily;
  if (profile.selectedVariant) state.authoredVariantDecision = profile.selectedVariant;
  if (profile.exportDecision) state.exportDecision = typeof profile.exportDecision === "string" ? profile.exportDecision : JSON.stringify(profile.exportDecision);
  return state;
};

const preserveUnsupportedLocalAssets = (cloud: WorkspaceProfile, local: WorkspaceProfile | undefined): WorkspaceProfile => {
  if (!local) return cloud;
  const cloudCompany = asRecord(parseJson(cloud.state.companyData));
  const localCompany = asRecord(parseJson(local.state.companyData));
  if (cloudCompany && localCompany && !cloudCompany.logoUrl && typeof localCompany.logoUrl === "string" && localCompany.logoUrl.startsWith("data:image/")) cloudCompany.logoUrl = localCompany.logoUrl;
  const cloudProjects = asArray(parseJson(cloud.state.projectsData));
  const localProjects = asArray(parseJson(local.state.projectsData));
  const localById = new Map(localProjects.map((project) => [safeString(project.id), project]));
  for (const project of cloudProjects) {
    const localProject = localById.get(safeString(project.id));
    if (localProject && !project.imageUrl && typeof localProject.imageUrl === "string" && localProject.imageUrl.startsWith("data:image/")) project.imageUrl = localProject.imageUrl;
  }
  if (cloudCompany) cloud.state.companyData = JSON.stringify(cloudCompany);
  if (cloudProjects.length) cloud.state.projectsData = JSON.stringify(cloudProjects);
  const cloudGenerated = parseJson(cloud.state.generatedProfile);
  const localGenerated = parseJson(local.state.generatedProfile);
  if (cloudGenerated && localGenerated) cloud.state.generatedProfile = JSON.stringify(mergeImagePayloads(cloudGenerated, localGenerated));
  return cloud;
};

export const workspaceFromCloud = (document: CloudWorkspaceDocument, localWorkspace?: Workspace): Workspace => {
  const localById = new Map((localWorkspace?.profiles ?? []).map((profile) => [profile.id, profile]));
  const profiles = document.profiles.map((record): WorkspaceProfile => preserveUnsupportedLocalAssets({
    id: record.profileId,
    displayName: record.displayName || "New Profile",
    createdAt: timestamp(record.createdAt),
    updatedAt: timestamp(record.updatedAt),
    state: stateFromCloudProfile(record),
  }, localById.get(record.profileId)));
  const activeProfileId = document.activeProfileId && profiles.some((profile) => profile.id === document.activeProfileId) ? document.activeProfileId : profiles[0]?.id ?? null;
  return { version: 1, profiles, activeProfileId };
};

export const migrationMarker = (userId: string): string => `${CLOUD_MIGRATION_PREFIX}${userId}`;
export const hasMeaningfulLocalWorkspace = (workspace: Workspace): boolean => workspace.profiles.some((profile) => Object.keys(profile.state).length > 0);
export const cloudProfileOwnership = (profile: CloudProfileRecord, userId: string, rowUserId: string): boolean => Boolean(userId && rowUserId && userId === rowUserId && profile.profileId.trim());
export const chooseAuthenticatedWorkspace = (cloud: CloudWorkspaceDocument | null, local: Workspace, ownerId: string | null, userId: string): { workspace: Workspace; shouldMigrate: boolean } => {
  const sameOwner = ownerId === userId;
  if (cloud?.profiles.length) return { workspace: workspaceFromCloud(cloud, sameOwner ? local : undefined), shouldMigrate: false };
  if (!sameOwner && ownerId) return { workspace: createEmptyWorkspace(), shouldMigrate: false };
  return { workspace: local, shouldMigrate: hasMeaningfulLocalWorkspace(local) };
};
