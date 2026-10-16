import assert from "node:assert/strict";
import { MAX_CLOUD_WORKSPACE_BYTES, readCloudWorkspaceJson } from "./cloud-workspace-request";

const request = (body: BodyInit, headers?: Record<string, string>): Request =>
  new Request("https://example.test/api/cloud/workspace", { method: "PUT", body, headers });

void (async () => {
  const valid = await readCloudWorkspaceJson(request(JSON.stringify({ version: 1, profiles: [] })));
  assert.deepEqual(valid, { ok: true, value: { version: 1, profiles: [] } });
  const malformed = await readCloudWorkspaceJson(request("{"));
  assert.deepEqual(malformed, { ok: false, code: "invalid_payload" });
  const declaredTooLarge = await readCloudWorkspaceJson(request("{}", { "content-length": String(MAX_CLOUD_WORKSPACE_BYTES + 1) }));
  assert.deepEqual(declaredTooLarge, { ok: false, code: "payload_too_large" });
  const streamedTooLarge = await readCloudWorkspaceJson(request("x".repeat(MAX_CLOUD_WORKSPACE_BYTES + 1)));
  assert.deepEqual(streamedTooLarge, { ok: false, code: "payload_too_large" });
  const exactLimit = await readCloudWorkspaceJson(request(JSON.stringify({ text: "a".repeat(MAX_CLOUD_WORKSPACE_BYTES - 11) })));
  assert.equal(exactLimit.ok, true, "A JSON document at the exact byte limit must remain accepted.");
  const invalidUtf8 = await readCloudWorkspaceJson(request(new Uint8Array([0xff])));
  assert.deepEqual(invalidUtf8, { ok: false, code: "invalid_payload" });
  console.log("Cloud workspace request streaming, size, and JSON safety checks passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
