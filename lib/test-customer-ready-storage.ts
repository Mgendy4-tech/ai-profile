import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cloudProfileFromLocal } from "./cloud-workspace";
import { hydrateCloudAsset, isOwnedAssetPath } from "./cloud-assets";
import { createEmptyWorkspace, type WorkspaceProfile } from "./workspace";

const migration = readFileSync(resolve("supabase", "customer-ready-v1.sql"), "utf8");
assert.match(migration, /insert into storage\.buckets/i);
assert.match(migration, /'customer-assets'/g);
assert.match(migration, /public\s*=\s*false/i);
assert.match(migration, /auth\.uid\(\)::text/i);
assert.match(migration, /for select to authenticated/i);
assert.match(migration, /for insert to authenticated/i);
assert.match(migration, /for delete to authenticated/i);
assert.doesNotMatch(migration, /service_role/i);

const workspace = createEmptyWorkspace();
const profile: WorkspaceProfile = {
  ...workspace.profiles[0],
  state: {
    companyData: JSON.stringify({ name: "Storage Gate", logoUrl: "data:image/png;base64,QUJD", logoPath: "user-a/profile-a/logo-one.png" }),
    projectsData: JSON.stringify([{ id: "project-a", name: "Project A", description: "A", imageUrl: "data:image/jpeg;base64,REVG", imagePath: "user-a/profile-a/project-one.jpg" }]),
  },
};
const cloud = cloudProfileFromLocal(profile);
assert.equal((cloud.companyData as Record<string, unknown>).logoUrl, "", "Cloud rows must not contain logo bytes.");
assert.equal((cloud.companyData as Record<string, unknown>).logoPath, "user-a/profile-a/logo-one.png");
assert.equal(cloud.projects[0].imageUrl, "", "Cloud rows must not contain project image bytes.");
assert.equal(cloud.projects[0].imagePath, "user-a/profile-a/project-one.jpg");
const signedLogoUrl = "https://project.supabase.co/storage/v1/object/sign/customer-assets/user-a/profile-a/logo-one.png?token=test";
const signedCloud = cloudProfileFromLocal({ ...profile, state: { ...profile.state, companyData: JSON.stringify({ name: "Storage Gate", logoUrl: signedLogoUrl, logoPath: "user-a/profile-a/logo-one.png" }) } });
assert.equal((signedCloud.companyData as Record<string, unknown>).logoUrl, "", "Runtime signed URLs must not be persisted as cloud metadata.");
assert.equal(isOwnedAssetPath("user-a/profile-a/logo-one.png", "user-a", "profile-a"), true, "Authenticated asset paths must begin with auth.uid()/profileId.");
assert.equal(isOwnedAssetPath("user-a/profile-a/logo-one.png", "user-b", "profile-a"), false, "Account B must not resolve Account A asset paths.");
void (async () => {
  const signedClient = {
    auth: { getUser: async () => ({ data: { user: { id: "user-a" } } }) },
    storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: signedLogoUrl }, error: null }) }) },
  } as never;
  assert.equal(await hydrateCloudAsset("user-a/profile-a/logo-one.png", "profile-a", signedClient), signedLogoUrl, "Hydration must render the private signed URL without a CORS-dependent browser download.");
  const otherAccountClient = {
    auth: { getUser: async () => ({ data: { user: { id: "user-b" } } }) },
    storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: signedLogoUrl }, error: null }) }) },
  } as never;
  assert.equal(await hydrateCloudAsset("user-a/profile-a/logo-one.png", "profile-a", otherAccountClient), "", "Account B must not hydrate Account A assets.");
  console.log("Customer-ready private storage and cloud asset-reference tests passed.");
})();
