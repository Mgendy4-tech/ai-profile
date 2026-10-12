import { getPlanEntitlements, type PlanEntitlements } from "./plans";

export type EntitlementCheck = { allowed: boolean; code: "allowed" | "profile_limit" | "export_limit" | "cloud_workspace" | "premium_templates"; entitlements: PlanEntitlements };

export const canCreateProfile = (plan: unknown, currentProfileCount: number): EntitlementCheck => {
  const entitlements = getPlanEntitlements(plan);
  return { allowed: entitlements.profileLimit === null || currentProfileCount < entitlements.profileLimit, code: entitlements.profileLimit === null || currentProfileCount < entitlements.profileLimit ? "allowed" : "profile_limit", entitlements };
};

export const canExportProfile = (plan: unknown, exportsUsed: number): EntitlementCheck => {
  const entitlements = getPlanEntitlements(plan);
  return { allowed: entitlements.exportLimit === null || exportsUsed < entitlements.exportLimit, code: entitlements.exportLimit === null || exportsUsed < entitlements.exportLimit ? "allowed" : "export_limit", entitlements };
};

export const canUseCloudWorkspace = (plan: unknown): EntitlementCheck => {
  const entitlements = getPlanEntitlements(plan);
  return { allowed: entitlements.cloudWorkspace, code: entitlements.cloudWorkspace ? "allowed" : "cloud_workspace", entitlements };
};

export const canUsePremiumTemplates = (plan: unknown): EntitlementCheck => {
  const entitlements = getPlanEntitlements(plan);
  return { allowed: entitlements.premiumTemplates, code: entitlements.premiumTemplates ? "allowed" : "premium_templates", entitlements };
};
