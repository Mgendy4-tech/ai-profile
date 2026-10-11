import assert from "node:assert/strict";
import { fetchCloudJson } from "./cloud-sync-lifecycle";

const signal = () => new AbortController().signal;
const response = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

void (async () => {
const successful = await fetchCloudJson(async (_input, init) => {
  assert(init?.headers && new Headers(init.headers).get("authorization") === "Bearer token-a");
  return response(200, { ok: true, workspace: null });
}, "/api/cloud/workspace", { headers: { Authorization: "Bearer token-a" } }, signal());
assert.equal(successful.ok, true, "Successful cloud responses must settle successfully.");

const rejected = await fetchCloudJson(async () => response(403, { ok: false, code: "unauthorized" }), "/api/cloud/workspace", {}, signal());
assert.deepEqual(rejected, { ok: false, code: "unauthorized", status: 403 }, "HTTP/API failures must settle as failed results.");

const malformed = await fetchCloudJson(async () => new Response("not-json", { status: 200 }), "/api/cloud/workspace", {}, signal());
assert.deepEqual(malformed, { ok: false, code: "invalid_response", status: 200 }, "Malformed JSON must not leave sync pending.");

const timedOut = await fetchCloudJson(async (_input, init) => await new Promise<Response>((_resolve, reject) => {
  init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
}), "/api/cloud/workspace", {}, signal(), 10);
assert.equal(timedOut.ok, false);
assert.equal(timedOut.code, "timeout", "Hanging requests must settle as timeout failures.");

const abortedController = new AbortController();
const abortedPromise = fetchCloudJson(async (_input, init) => await new Promise<Response>((_resolve, reject) => {
  init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
}), "/api/cloud/workspace", {}, abortedController.signal, 1000);
abortedController.abort();
const aborted = await abortedPromise;
assert.deepEqual(aborted, { ok: false, code: "aborted" }, "Unmount/session cancellation must settle without a stale failure.");

console.log("Cloud sync request lifecycle tests passed: success, API failure, malformed response, timeout, and cancellation.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
