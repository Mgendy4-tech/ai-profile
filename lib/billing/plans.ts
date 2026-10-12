export type PlanId = "free" | "pro";

export type PlanEntitlements = {
  plan: PlanId;
  profileLimit: number | null;
  exportLimit: number | null;
  cloudWorkspace: boolean;
  premiumTemplates: boolean;
};

export const PLAN_ENTITLEMENTS: Readonly<Record<PlanId, PlanEntitlements>> = {
  free: { plan: "free", profileLimit: 3, exportLimit: 10, cloudWorkspace: false, premiumTemplates: false },
  pro: { plan: "pro", profileLimit: 25, exportLimit: 100, cloudWorkspace: true, premiumTemplates: true },
};

export const normalizePlanId = (value: unknown): PlanId => value === "pro" ? "pro" : "free";

export const getPlanEntitlements = (value: unknown = "free"): PlanEntitlements => PLAN_ENTITLEMENTS[normalizePlanId(value)];
