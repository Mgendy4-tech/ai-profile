import assert from "node:assert/strict";
import { chooseAuthenticatedWorkspace, cloudProfileFromLocal, cloudProfileOwnership, hasMeaningfulLocalWorkspace, migrationMarker, workspaceFromCloud, workspaceToCloudPayload } from "./cloud-workspace";
import { createWorkspaceProfile, createEmptyWorkspace, type Workspace } from "./workspace";

const image = "data:image/png;base64,small";
const profile = createWorkspaceProfile("Aurelia Interiors", 100);
profile.state = {
  companyData: JSON.stringify({ name: "Aurelia Interiors", companyType: "Interior Design Studio", logoUrl: image }),
  projectsData: JSON.stringify([{ id: "riverside", name: "Riverside", description: "A project", imageUrl: image }]),
  generatedProfile: JSON.stringify({ companyName: "Aurelia Interiors", sourceFingerprint: "fp-1" }),
  authoredFamilyDecision: "visual-portfolio",
  authoredVariantDecision: "visual-gallery",
};
const local: Workspace = { version: 1, profiles: [profile], activeProfileId: profile.id };
const payload = workspaceToCloudPayload(local);
assert.equal(payload.profiles[0].selectedFamily, "visual-portfolio");
assert.deepEqual(payload.profiles[0].unsupportedAssets, ["company.logoUrl", "projects.0.imageUrl"]);
assert.equal(payload.profiles[0].companyData?.logoUrl, "", "Base64 logos must not be written to cloud rows.");
assert.equal(payload.profiles[0].projects[0].imageUrl, "", "Base64 project images must not be written to cloud rows.");
assert.equal(hasMeaningfulLocalWorkspace(local), true);
assert.equal(migrationMarker("user-a"), "workspaceCloudMigration:user-a");
assert.equal(cloudProfileOwnership(payload.profiles[0], "user-a", "user-a"), true);
assert.equal(cloudProfileOwnership(payload.profiles[0], "user-a", "user-b"), false);

const cloud = { ...payload, profiles: payload.profiles.map((item) => ({ ...item, companyData: { name: "Aurelia Interiors", companyType: "Interior Design Studio", logoUrl: "" }, projects: [{ id: "riverside", name: "Riverside", description: "A project", imageUrl: "" }] })) };
const hydrated = workspaceFromCloud(cloud, local);
assert.equal(JSON.parse(hydrated.profiles[0].state.companyData ?? "{}").logoUrl, image, "Local image cache must survive cloud metadata hydration.");
assert.equal(JSON.parse(hydrated.profiles[0].state.projectsData ?? "[]")[0].imageUrl, image, "Local project image cache must survive cloud metadata hydration.");
assert.equal(JSON.parse(hydrated.profiles[0].state.generatedProfile ?? "{}").sourceFingerprint, "fp-1");

const first = chooseAuthenticatedWorkspace(null, local, null, "user-a");
assert.equal(first.shouldMigrate, true);
const second = chooseAuthenticatedWorkspace({ ...payload, profiles: [] }, local, "user-a", "user-b");
assert.equal(second.shouldMigrate, false);
assert.notEqual(second.workspace.activeProfileId, local.activeProfileId, "A second account must not inherit the first account's active profile.");
const cloudWins = chooseAuthenticatedWorkspace(cloud, local, "user-a", "user-a");
assert.equal(cloudWins.shouldMigrate, false);

const empty = createEmptyWorkspace();
assert.equal(empty.profiles.length, 1);
console.log("Cloud workspace mapping, image fallback, migration, conflict, and ownership tests passed.");
