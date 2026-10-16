import assert from "node:assert/strict";
import { isCloudWorkspacePayload } from "./cloud-workspace-payload";
import { workspaceToCloudPayload } from "./cloud-workspace";
import { createEmptyWorkspace, MAX_WORKSPACE_PROFILES } from "./workspace";

const valid = workspaceToCloudPayload(createEmptyWorkspace());
assert.equal(isCloudWorkspacePayload(valid), true, "An ordinary client workspace must remain accepted.");
type MutablePayload = { version: number; activeProfileId: string | null; profiles: Array<Record<string, unknown>> };
const clone = (): MutablePayload => structuredClone(valid) as unknown as MutablePayload;
const reject = (description: string, mutate: (payload: MutablePayload) => void): void => {
  const payload = clone();
  mutate(payload);
  assert.equal(isCloudWorkspacePayload(payload), false, description);
};

reject("Empty workspace must not delete every cloud profile", (p) => { p.profiles = []; p.activeProfileId = null; });
reject("Duplicate profile IDs must not be accepted", (p) => { p.profiles.push({ ...p.profiles[0] }); });
reject("More than the UI profile limit must be rejected", (p) => {
  p.profiles = Array.from({ length: MAX_WORKSPACE_PROFILES + 1 }, (_, index) => ({ ...p.profiles[0], profileId: `id-${index}` }));
});
reject("Active profile must belong to this workspace", (p) => { p.activeProfileId = "unknown"; });
reject("Blank profile IDs must be rejected", (p) => { p.profiles[0].profileId = " "; });
reject("Blank display names must be rejected", (p) => { p.profiles[0].displayName = ""; });
reject("Missing creation dates must be rejected", (p) => { delete p.profiles[0].createdAt; });
reject("Malformed project data must be rejected", (p) => { p.profiles[0].projects = "invalid"; });
reject("Malformed generated profile must be rejected", (p) => { p.profiles[0].generatedProfile = []; });
reject("Malformed unsupported assets must be rejected", (p) => { p.profiles[0].unsupportedAssets = [null]; });
reject("Unsupported schema versions must be rejected", (p) => { p.version = 2; });
assert.equal(isCloudWorkspacePayload({ ...valid, activeProfileId: null }), true, "A null active profile is safe.");
console.log("Cloud workspace API payload validation passed.");
