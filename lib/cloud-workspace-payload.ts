import type { CloudWorkspacePayload } from "./cloud-workspace";
import { MAX_WORKSPACE_PROFILES } from "./workspace";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isOptionalRecord = (value: unknown): boolean => value === null || isRecord(value);
const isOptionalText = (value: unknown): boolean => value === null || typeof value === "string";
const isValidDate = (value: unknown): boolean =>
  typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
const isRecordArray = (value: unknown): boolean => Array.isArray(value) && value.every(isRecord);
const isStringArray = (value: unknown): boolean =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

// Images belong in private Storage, never in workspace JSON rows. Expiring
// signed URLs also must not be persisted as durable cloud profile data.
const hasUnsafeAssetValue = (value: unknown, depth = 0): boolean => {
  if (depth > 32) return true;
  if (typeof value === "string") {
    return /^data:image\//i.test(value) ||
      /^https?:\/\/[^\s]+\/storage\/v1\/object\/sign\/customer-assets\//i.test(value);
  }
  if (Array.isArray(value)) return value.some((item) => hasUnsafeAssetValue(item, depth + 1));
  if (isRecord(value)) return Object.values(value).some((item) => hasUnsafeAssetValue(item, depth + 1));
  return false;
};

export const isCloudWorkspacePayload = (value: unknown): value is CloudWorkspacePayload => {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.profiles)) return false;
  if (value.profiles.length > MAX_WORKSPACE_PROFILES) return false;
  const seen = new Set<string>();
  for (const entry of value.profiles) {
    if (!isRecord(entry)) return false;
    if (typeof entry.profileId !== "string" || !entry.profileId.trim() || entry.profileId.length > 256 || seen.has(entry.profileId)) return false;
    if (typeof entry.displayName !== "string" || !entry.displayName.trim() || entry.displayName.length > 500) return false;
    if (!isValidDate(entry.createdAt) || !isValidDate(entry.updatedAt)) return false;
    if (!isOptionalRecord(entry.companyData) || !isRecordArray(entry.projects)) return false;
    if (!isOptionalRecord(entry.generatedProfile) || !isOptionalRecord(entry.profileStructure)) return false;
    if (!isOptionalText(entry.selectedFamily) || !isOptionalText(entry.selectedVariant)) return false;
    if (!(isOptionalText(entry.exportDecision) || isRecord(entry.exportDecision))) return false;
    if (!isRecord(entry.freshness) || !isStringArray(entry.unsupportedAssets)) return false;
    if (hasUnsafeAssetValue(entry)) return false;
    seen.add(entry.profileId);
  }
  return value.activeProfileId === null ||
    (typeof value.activeProfileId === "string" && seen.has(value.activeProfileId));
};
