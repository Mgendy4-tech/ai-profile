import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const bucket = "customer-assets";
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_TEST_ACCOUNT_A_EMAIL",
  "SUPABASE_TEST_ACCOUNT_A_PASSWORD",
  "SUPABASE_TEST_ACCOUNT_B_EMAIL",
  "SUPABASE_TEST_ACCOUNT_B_PASSWORD",
] as const;
const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length) {
  console.log(JSON.stringify({ status: "BLOCKED", reason: "Two disposable authenticated Supabase test accounts are not configured locally.", missingVariables: missing, credentialsPrinted: false }, null, 2));
  process.exitCode = 2;
} else {
  type WorkspaceRow = { user_id: string; version: number; active_profile_id: string | null; updated_at: string };
  type Account = { label: "A" | "B"; client: SupabaseClient; userId: string };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim();

  const client = () => createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const errorText = (error: { code?: string; message?: string } | null): string => error ? `${error.code ?? "unknown"}:${error.message ?? "error"}` : "";
  const requireNoError = (operation: string, error: { code?: string; message?: string } | null): void => { if (error) throw new Error(`${operation} failed: ${errorText(error)}`); };
  const signIn = async (label: "A" | "B", email: string, password: string): Promise<Account> => {
    const current = client();
    const result = await current.auth.signInWithPassword({ email, password });
    if (result.error || !result.data.user) throw new Error(`Account ${label} sign-in failed: ${result.error?.code ?? "no_user"}`);
    return { label, client: current, userId: result.data.user.id };
  };
  const readWorkspace = async (account: Account, userId: string): Promise<WorkspaceRow | null> => {
    const result = await account.client.from("cloud_workspaces").select("user_id, version, active_profile_id, updated_at").eq("user_id", userId).maybeSingle();
    requireNoError(`${account.label} workspace read`, result.error);
    return result.data as WorkspaceRow | null;
  };
  const readProfile = async (account: Account, userId: string, profileId: string): Promise<Record<string, unknown> | null> => {
    const result = await account.client.from("cloud_profiles").select("*").eq("user_id", userId).eq("profile_id", profileId).maybeSingle();
    requireNoError(`${account.label} profile read`, result.error);
    return result.data as Record<string, unknown> | null;
  };
  const download = async (account: Account, path: string): Promise<Uint8Array> => {
    const result = await account.client.storage.from(bucket).download(path);
    requireNoError(`${account.label} asset download`, result.error);
    assert.ok(result.data, `${account.label} asset download returned no data`);
    return new Uint8Array(await result.data.arrayBuffer());
  };
  const signedDownload = async (account: Account, path: string, expected: Uint8Array): Promise<void> => {
    const signed = await account.client.storage.from(bucket).createSignedUrl(path, 60);
    requireNoError(`${account.label} signed URL`, signed.error);
    assert.ok(signed.data?.signedUrl, `${account.label} signed URL missing`);
    const response = await fetch(signed.data.signedUrl);
    assert.equal(response.status, 200, `${account.label} signed URL did not download`);
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), expected, `${account.label} signed asset bytes changed`);
  };
  const crossUserWritesMustBeBlocked = async (account: Account, userId: string, profileId: string, assetPath: string): Promise<void> => {
    const profileUpdate = await account.client.from("cloud_profiles").update({ display_name: "must-not-write" }).eq("user_id", userId).eq("profile_id", profileId).select("profile_id");
    assert.equal(profileUpdate.data?.length ?? 0, 0, "Account B updated Account A profile");
    const profileDelete = await account.client.from("cloud_profiles").delete().eq("user_id", userId).eq("profile_id", profileId).select("profile_id");
    assert.equal(profileDelete.data?.length ?? 0, 0, "Account B deleted Account A profile");
    const workspaceUpdate = await account.client.from("cloud_workspaces").update({ active_profile_id: "must-not-write" }).eq("user_id", userId).select("user_id");
    assert.equal(workspaceUpdate.data?.length ?? 0, 0, "Account B updated Account A workspace");
    const workspaceDelete = await account.client.from("cloud_workspaces").delete().eq("user_id", userId).select("user_id");
    assert.equal(workspaceDelete.data?.length ?? 0, 0, "Account B deleted Account A workspace");
    const assetUpdate = await account.client.storage.from(bucket).update(assetPath, Buffer.from("not-account-a"), { contentType: "image/png" });
    assert.ok(assetUpdate.error, "Account B updated Account A asset");
    const assetDelete = await account.client.storage.from(bucket).remove([assetPath]);
    assert.ok(assetDelete.error || !(assetDelete.data ?? []).some((entry) => entry.name === assetPath.split("/").pop()), "Account B deleted Account A asset");
  };

  const run = async (): Promise<Record<string, unknown>> => {
    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const profileId = `ab-security-${suffix}`;
    const bProfileId = `ab-security-b-${suffix}`;
    const a = await signIn("A", process.env.SUPABASE_TEST_ACCOUNT_A_EMAIL!, process.env.SUPABASE_TEST_ACCOUNT_A_PASSWORD!);
    const b = await signIn("B", process.env.SUPABASE_TEST_ACCOUNT_B_EMAIL!, process.env.SUPABASE_TEST_ACCOUNT_B_PASSWORD!);
    assert.notEqual(a.userId, b.userId, "Account A and B resolved to the same user");
    const aWorkspaceBefore = await readWorkspace(a, a.userId);
    const bWorkspaceBefore = await readWorkspace(b, b.userId);
    const logoPath = `${a.userId}/${profileId}/logo.png`;
    const projectPath = `${a.userId}/${profileId}/project.jpg`;
    const bPath = `${b.userId}/${bProfileId}/logo.png`;
    const logoBytes = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWO4o6HxHwAFPAIsLJMkUQAAAABJRU5ErkJggg==", "base64"));
    const replacementBytes = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADUlEQVQImWPQqLjzHwAExAJ88J3R2AAAAABJRU5ErkJggg==", "base64"));
    const projectBytes = Uint8Array.from(Buffer.from("/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/AP/EABQQAQAAAAAAAAAAAAAAAAAAADD/2gAIAQEAAT8h/8QAFBEBAAAAAAAAAAAAAAAAAAAAEP/aAAgBAgEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAEP/aAAgBAwEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAEP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAEP/aAAgBAQABPyF//9k=", "base64"));
    try {
      requireNoError("Account A logo upload", (await a.client.storage.from(bucket).upload(logoPath, Buffer.from(logoBytes), { contentType: "image/png", upsert: false })).error);
      requireNoError("Account A project upload", (await a.client.storage.from(bucket).upload(projectPath, Buffer.from(projectBytes), { contentType: "image/jpeg", upsert: false })).error);
      requireNoError("Account A profile create", (await a.client.from("cloud_profiles").insert({ user_id: a.userId, profile_id: profileId, display_name: "Disposable A/B isolation fixture", company_data: { name: "Account A fixture", logoPath }, projects: [{ id: `${profileId}-project`, name: "A project fixture", imagePath: projectPath }], generated_profile: null, profile_structure: null, selected_family: null, selected_variant: null, export_decision: null, freshness: {}, unsupported_assets: [] })).error);
      requireNoError("Account A workspace create/update", (await a.client.from("cloud_workspaces").upsert({ user_id: a.userId, version: 1, active_profile_id: profileId, updated_at: new Date().toISOString() }, { onConflict: "user_id" })).error);
      assert.deepEqual(await download(a, logoPath), logoBytes, "Account A logo persistence failed");
      assert.deepEqual(await download(a, projectPath), projectBytes, "Account A project persistence failed");
      await signedDownload(a, logoPath, logoBytes);
      await signedDownload(a, projectPath, projectBytes);
      requireNoError("Account A profile update", (await a.client.from("cloud_profiles").update({ display_name: "Disposable A/B isolation fixture updated" }).eq("user_id", a.userId).eq("profile_id", profileId)).error);
      assert.equal((await readProfile(a, a.userId, profileId))?.display_name, "Disposable A/B isolation fixture updated", "Account A profile update failed");
      requireNoError("Account A asset replacement", (await a.client.storage.from(bucket).update(logoPath, Buffer.from(replacementBytes), { contentType: "image/png" })).error);
      assert.deepEqual(await download(a, logoPath), replacementBytes, "Account A asset replacement failed");
      assert.equal((await readWorkspace(a, a.userId))?.active_profile_id, profileId, "Account A workspace persistence failed");

      assert.equal(await readProfile(b, a.userId, profileId), null, "Account B read Account A profile");
      assert.equal(await readWorkspace(b, a.userId), null, "Account B read Account A workspace");
      assert.ok((await b.client.storage.from(bucket).download(logoPath)).error, "Account B downloaded Account A asset");
      const bSigned = await b.client.storage.from(bucket).createSignedUrl(logoPath, 60);
      assert.ok(bSigned.error || !bSigned.data?.signedUrl, "Account B signed Account A asset");
      await crossUserWritesMustBeBlocked(b, a.userId, profileId, logoPath);
      assert.equal((await readProfile(a, a.userId, profileId))?.display_name, "Disposable A/B isolation fixture updated", "Account B changed Account A profile");
      assert.deepEqual(await download(a, logoPath), replacementBytes, "Account B changed Account A asset");

      requireNoError("Account B profile create", (await b.client.from("cloud_profiles").insert({ user_id: b.userId, profile_id: bProfileId, display_name: "Disposable B fixture", company_data: { name: "Account B fixture", logoPath: bPath }, projects: [], generated_profile: null, profile_structure: null, selected_family: null, selected_variant: null, export_decision: null, freshness: {}, unsupported_assets: [] })).error);
      requireNoError("Account B workspace create/update", (await b.client.from("cloud_workspaces").upsert({ user_id: b.userId, version: 1, active_profile_id: bProfileId, updated_at: new Date().toISOString() }, { onConflict: "user_id" })).error);
      requireNoError("Account B logo upload", (await b.client.storage.from(bucket).upload(bPath, Buffer.from(logoBytes), { contentType: "image/png", upsert: false })).error);
      assert.equal((await readProfile(b, b.userId, bProfileId))?.profile_id, bProfileId, "Account B cannot read its profile");
      assert.deepEqual(await download(b, bPath), logoBytes, "Account B cannot read its own asset");

      const freshA = await signIn("A", process.env.SUPABASE_TEST_ACCOUNT_A_EMAIL!, process.env.SUPABASE_TEST_ACCOUNT_A_PASSWORD!);
      assert.equal((await readProfile(freshA, a.userId, profileId))?.profile_id, profileId, "Fresh Account A session cannot read profile");
      assert.deepEqual(await download(freshA, logoPath), replacementBytes, "Fresh Account A session cannot hydrate logo");
      assert.deepEqual(await download(freshA, projectPath), projectBytes, "Fresh Account A session cannot hydrate project image");
      await freshA.client.auth.signOut();

      const switching = client();
      requireNoError("Account switch sign-in A", (await switching.auth.signInWithPassword({ email: process.env.SUPABASE_TEST_ACCOUNT_A_EMAIL!, password: process.env.SUPABASE_TEST_ACCOUNT_A_PASSWORD! })).error);
      assert.ok((await switching.from("cloud_profiles").select("profile_id").eq("user_id", a.userId).eq("profile_id", profileId).maybeSingle()).data, "Account switch A read failed");
      requireNoError("Account switch sign-out", (await switching.auth.signOut()).error);
      assert.equal((await switching.auth.getUser()).data.user, null, "Sign-out left an authenticated user");
      requireNoError("Account switch sign-in B", (await switching.auth.signInWithPassword({ email: process.env.SUPABASE_TEST_ACCOUNT_B_EMAIL!, password: process.env.SUPABASE_TEST_ACCOUNT_B_PASSWORD! })).error);
      const staleA = await switching.from("cloud_profiles").select("profile_id").eq("user_id", a.userId).eq("profile_id", profileId).maybeSingle();
      requireNoError("Account B stale-data check", staleA.error);
      assert.equal(staleA.data, null, "Account B saw Account A data after switching");
      assert.equal((await switching.from("cloud_profiles").select("profile_id").eq("user_id", b.userId).eq("profile_id", bProfileId).maybeSingle()).data?.profile_id, bProfileId, "Account B own data missing after switching");
      await switching.auth.signOut();

      const signedOut = client();
      requireNoError("Signed-out fixture sign-in", (await signedOut.auth.signInWithPassword({ email: process.env.SUPABASE_TEST_ACCOUNT_A_EMAIL!, password: process.env.SUPABASE_TEST_ACCOUNT_A_PASSWORD! })).error);
      requireNoError("Signed-out fixture sign-out", (await signedOut.auth.signOut()).error);
      assert.ok((await signedOut.storage.from(bucket).download(logoPath)).error, "Signed-out client downloaded private asset");
      return { status: "PASS", liveSupabase: true, accountIsolation: "PASS", profileWorkspaceIsolation: "PASS", storageIsolation: "PASS", freshSessionHydration: "PASS", accountSwitchingAndSignOut: "PASS", formats: ["PNG logo", "JPEG project"], serviceRoleUsed: false, credentialsPrinted: false };
    } finally {
      const cleanupA = await a.client.storage.from(bucket).remove([logoPath, projectPath]);
      if (cleanupA.error) console.error(`Cleanup warning A assets: ${errorText(cleanupA.error)}`);
      const cleanupB = await b.client.storage.from(bucket).remove([bPath]);
      if (cleanupB.error) console.error(`Cleanup warning B assets: ${errorText(cleanupB.error)}`);
      const deleteA = await a.client.from("cloud_profiles").delete().eq("user_id", a.userId).eq("profile_id", profileId);
      if (deleteA.error) console.error(`Cleanup warning A profile: ${errorText(deleteA.error)}`);
      const deleteB = await b.client.from("cloud_profiles").delete().eq("user_id", b.userId).eq("profile_id", bProfileId);
      if (deleteB.error) console.error(`Cleanup warning B profile: ${errorText(deleteB.error)}`);
      if (aWorkspaceBefore) {
        const restoreA = await a.client.from("cloud_workspaces").upsert(aWorkspaceBefore, { onConflict: "user_id" });
        if (restoreA.error) console.error(`Cleanup warning A workspace restore: ${errorText(restoreA.error)}`);
      } else {
        const removeA = await a.client.from("cloud_workspaces").delete().eq("user_id", a.userId).eq("active_profile_id", profileId);
        if (removeA.error) console.error(`Cleanup warning A workspace removal: ${errorText(removeA.error)}`);
      }
      if (bWorkspaceBefore) {
        const restoreB = await b.client.from("cloud_workspaces").upsert(bWorkspaceBefore, { onConflict: "user_id" });
        if (restoreB.error) console.error(`Cleanup warning B workspace restore: ${errorText(restoreB.error)}`);
      } else {
        const removeB = await b.client.from("cloud_workspaces").delete().eq("user_id", b.userId).eq("active_profile_id", bProfileId);
        if (removeB.error) console.error(`Cleanup warning B workspace removal: ${errorText(removeB.error)}`);
      }
    }
  };

  run().then((result) => console.log(JSON.stringify(result, null, 2))).catch((error: unknown) => {
    console.error(JSON.stringify({ status: "FAIL", liveSupabase: true, message: error instanceof Error ? error.message : "unknown integration failure", credentialsPrinted: false }, null, 2));
    process.exitCode = 1;
  });
}
