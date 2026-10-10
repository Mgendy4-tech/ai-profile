import assert from "node:assert/strict";
import {
  MAX_WORKSPACE_PROFILES,
  WORKSPACE_PROFILE_STATE_KEYS,
  WORKSPACE_STORAGE_KEY,
  createProfile,
  deleteProfile,
  duplicateProfile,
  mutateWorkspace,
  readWorkspace,
  readWorkspaceProfileValue,
  switchProfile,
  type WorkspaceStorage,
} from "./workspace";

class MemoryStorage implements WorkspaceStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const storage = new MemoryStorage();
storage.setItem("companyData", JSON.stringify({ name: "Aurelia Interiors", about: "A studio" }));
storage.setItem("projectsData", JSON.stringify([{ id: "project:a", name: "Riverside", description: "Residential interiors", imageUrl: "data:image/png;base64,VALID" }]));
storage.setItem("authoredFamilyDecision", "visual-portfolio");
storage.setItem("authoredVariantDecision", "visual-gallery");

const migrated = readWorkspace(storage);
assert.equal(migrated.profiles.length, 1, "Legacy state must migrate to one workspace profile.");
assert.equal(readWorkspaceProfileValue(migrated.profiles[0], "companyData"), JSON.stringify({ name: "Aurelia Interiors", about: "A studio" }));
assert.equal(readWorkspaceProfileValue(migrated.profiles[0], "authoredVariantDecision"), "visual-gallery");
assert.equal(storage.getItem("companyData"), null, "Legacy keys must not remain authoritative after migration.");
assert.equal(readWorkspace(storage).profiles[0].id, migrated.profiles[0].id, "Migration must be idempotent across reloads.");

const originalId = migrated.activeProfileId!;
const created = createProfile(storage, "Northbridge Advisory");
assert(created.ok && created.profile, "A second workspace profile must be creatable.");
const secondId = created.profile!.id;
assert.notEqual(secondId, originalId);
assert.equal(readWorkspaceProfileValue(readWorkspace(storage).profiles.find((profile) => profile.id === secondId)!, "companyData"), null, "New profiles must start empty.");
assert(switchProfile(storage, originalId).ok, "Switching back to the original profile must succeed.");

const duplicated = duplicateProfile(storage, originalId);
assert(duplicated.ok && duplicated.profile, "A profile must be duplicable.");
assert.notEqual(duplicated.profile!.id, originalId, "Duplicate must have a new stable profile ID.");
const duplicateId = duplicated.profile!.id;
assert.equal(readWorkspaceProfileValue(readWorkspace(storage).profiles.find((profile) => profile.id === duplicateId)!, "projectsData"), readWorkspaceProfileValue(readWorkspace(storage).profiles.find((profile) => profile.id === originalId)!, "projectsData"), "Duplicate must copy project data.");
mutateWorkspace(storage, (workspace) => ({ ...workspace, profiles: workspace.profiles.map((profile) => profile.id === duplicateId ? { ...profile, state: { ...profile.state, companyData: JSON.stringify({ name: "Edited Copy" }) } } : profile) }));
assert.match(readWorkspaceProfileValue(readWorkspace(storage).profiles.find((profile) => profile.id === originalId)!, "companyData")!, /Aurelia Interiors/, "Changing a duplicate must not mutate the original.");

assert(switchProfile(storage, duplicateId).ok);
assert(deleteProfile(storage, duplicateId).ok, "Deleting the active profile must succeed.");
assert.equal(readWorkspace(storage).activeProfileId, originalId, "Deleting the active profile must fall back to another profile.");

for (let index = readWorkspace(storage).profiles.length; index < MAX_WORKSPACE_PROFILES; index += 1) assert(createProfile(storage, `Profile ${index + 1}`).ok);
assert.equal(readWorkspace(storage).profiles.length, MAX_WORKSPACE_PROFILES);
assert.equal(createProfile(storage, "Over limit").ok, false, "Workspace profile limit must be enforced.");

const malformed = new MemoryStorage();
malformed.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify({ version: 1, profiles: [{ id: "valid", displayName: "Valid", state: { companyData: "{}" } }, null], activeProfileId: "valid" }));
assert.equal(readWorkspace(malformed).profiles.length, 1, "Malformed profile entries must not crash workspace recovery.");
assert.deepEqual(WORKSPACE_PROFILE_STATE_KEYS, ["companyData", "projectsData", "profileStructure", "generatedProfile", "authoredFamilyDecision", "authoredVariantDecision", "exportDecision"]);

console.log("Workspace migration, isolation, duplication, deletion, malformed recovery, idempotence, and profile-limit tests passed.");
