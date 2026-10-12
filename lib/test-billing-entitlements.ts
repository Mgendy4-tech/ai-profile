import assert from "node:assert/strict";
import { canCreateProfile, canExportProfile, canUseCloudWorkspace, canUsePremiumTemplates } from "./billing/entitlements";
import { getPlanEntitlements, normalizePlanId } from "./billing/plans";

assert.equal(normalizePlanId("unknown"), "free");
assert.equal(getPlanEntitlements("free").profileLimit, 3);
assert.equal(canCreateProfile("free", 2).allowed, true);
assert.equal(canCreateProfile("free", 3).code, "profile_limit");
assert.equal(canExportProfile("pro", 99).allowed, true);
assert.equal(canExportProfile("pro", 100).code, "export_limit");
assert.equal(canUseCloudWorkspace("free").allowed, false);
assert.equal(canUseCloudWorkspace("pro").allowed, true);
assert.equal(canUsePremiumTemplates("pro").allowed, true);
console.log("Billing plan and entitlement foundation tests passed.");
