import assert from "node:assert/strict";
import { hydrateCloudAsset } from "./cloud-assets";
import { clearTrustedHydratedCloudAssets, isTrustedHydratedCloudAsset, registerTrustedHydratedCloudAsset } from "./cloud-asset-trust";
import { validateAuthoredImageOperationalLimits } from "./production-limits";
import { persistedImageState } from "./persisted-projects";
import { materializeTrustedAuthoredImage } from "./authored-image-optimization";

const userId = "user-a";
const profileId = "profile-a";
const logoPath = `${userId}/${profileId}/logo-one.png`;
const projectPath = `${userId}/${profileId}/project-one.jpg`;
const logoUrl = `https://project.supabase.co/storage/v1/object/sign/customer-assets/${logoPath}?token=logo`;
const projectUrl = `https://project.supabase.co/storage/v1/object/sign/customer-assets/${projectPath}?token=project`;
const client = {
  auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
  storage: { from: () => ({ createSignedUrl: async (path: string) => ({ data: { signedUrl: path === logoPath ? logoUrl : projectUrl }, error: null }) }) },
} as never;

(async () => {
  clearTrustedHydratedCloudAssets();
  assert.equal(persistedImageState("data:image/png;base64,QUJD"), "valid", "Local data images remain valid.");
  assert.equal(await hydrateCloudAsset(logoPath, profileId, client, "logo"), logoUrl, "Owned logo hydration must register the signed asset.");
  assert.equal(await hydrateCloudAsset(projectPath, profileId, client, "project"), projectUrl, "Owned project hydration must register the signed asset.");
  assert.equal(isTrustedHydratedCloudAsset(logoUrl, logoPath, "logo", profileId), true);
  assert.equal(isTrustedHydratedCloudAsset(projectUrl, projectPath, "project", profileId), true);
  assert.equal(persistedImageState(projectUrl, projectPath), "valid", "Trusted cloud project images are operationally valid.");
  assert.equal(validateAuthoredImageOperationalLimits({ logoUrl, logoPath }, [{ imageUrl: projectUrl, imagePath: projectPath }]).length, 0, "Owned cloud logo and project assets pass the authored export gate.");
  assert.equal(validateAuthoredImageOperationalLimits({ logoUrl: "https://images.example.com/logo.png" }, [{ imageUrl: projectUrl, imagePath: projectPath }])[0]?.code, "image_format_limit", "Arbitrary remote URLs remain rejected.");
  assert.equal(isTrustedHydratedCloudAsset(`${logoUrl}&path=forged`, logoPath, "logo", profileId), false, "Forged signed URLs remain rejected.");
  assert.equal(isTrustedHydratedCloudAsset(logoUrl, logoPath, "logo", "profile-b"), false, "Cross-profile references remain rejected.");
  assert.equal(isTrustedHydratedCloudAsset(logoUrl, "user-b/profile-a/logo-one.png", "logo", profileId), false, "Cross-user references remain rejected.");

  const refreshedUrl = `https://project.supabase.co/storage/v1/object/sign/customer-assets/${logoPath}?token=refreshed`;
  let fetchCount = 0;
  const previousFetch = globalThis.fetch;
  const globals = globalThis as unknown as { window?: typeof globalThis };
  const previousWindow = globals.window;
  globals.window = globalThis;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    fetchCount += 1;
    if (fetchCount === 1) return new Response("expired", { status: 403 });
    return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200, headers: { "content-type": "image/png" } });
  }) as typeof fetch;
  const refreshClient = {
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
    storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: refreshedUrl }, error: null }) }) },
  } as never;
  const refreshedSource = await materializeTrustedAuthoredImage(logoUrl, logoPath, profileId, "logo", refreshClient);
  assert.equal(fetchCount, 2, "Expired signed URLs must refresh once before materialization.");
  assert.match(refreshedSource, /^data:image\/png;base64,/i, "Refreshed cloud assets must become bounded data inputs for export.");
  globalThis.fetch = previousFetch;
  if (previousWindow === undefined) delete globals.window;
  else globals.window = previousWindow;

  const otherAccountClient = {
    auth: { getUser: async () => ({ data: { user: { id: "user-b" } } }) },
    storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: logoUrl }, error: null }) }) },
  } as never;
  assert.equal(await hydrateCloudAsset(logoPath, profileId, otherAccountClient, "logo"), "", "Account B cannot hydrate Account A assets.");
  console.log("Focused authenticated cloud authored-asset trust tests passed.");
})();
