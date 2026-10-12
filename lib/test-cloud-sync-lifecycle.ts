import assert from "node:assert/strict";
import { CloudSyncCoordinator, fetchCloudJson } from "./cloud-sync-lifecycle";

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

type TestSession = { user: { id: string }; access_token: string };
const sessionA: TestSession = { user: { id: "user-a" }, access_token: "token-a" };
const states: Array<{ state: string; operationId: number }> = [];
let runs = 0;
const coordinator = new CloudSyncCoordinator<TestSession>((session) => session.user.id, (state, _message, operationId) => states.push({ state, operationId }), 100);
const runner = async (_session: TestSession, _signal: AbortSignal) => { runs += 1; return { ok: true as const, fingerprint: "fp-1" }; };
const first = coordinator.request(sessionA, "fp-1", runner);
const duplicate = coordinator.request({ ...sessionA, access_token: "refreshed-token" }, "fp-1", runner);
await Promise.all([first, duplicate]);
assert.equal(runs, 1, "Duplicate auth/session events must share one sync.");
assert.deepEqual(states.map((entry) => entry.state), ["syncing", "synced"], "One operation must settle through syncing to synced.");
await coordinator.request(sessionA, "fp-1", runner);
assert.equal(runs, 1, "Identical fingerprints must not trigger another PUT/sync.");

let releaseFirst: (() => void) | null = null;
let queuedRuns = 0;
const queuedCoordinator = new CloudSyncCoordinator<TestSession>((session) => session.user.id, () => undefined, 100);
const queuedRunner = async (_session: TestSession, _signal: AbortSignal) => {
  queuedRuns += 1;
  if (queuedRuns === 1) await new Promise<void>((resolve) => { releaseFirst = resolve; });
  return { ok: true as const, fingerprint: queuedRuns === 1 ? "fp-1" : "fp-3" };
};
const active = queuedCoordinator.request(sessionA, "fp-1", queuedRunner);
queuedCoordinator.request(sessionA, "fp-2", queuedRunner, true);
queuedCoordinator.request(sessionA, "fp-3", queuedRunner, true);
releaseFirst!();
await active;
await new Promise((resolve) => setTimeout(resolve, 0));
assert.equal(queuedRuns, 2, "Changes during sync must coalesce into one latest follow-up.");

let hungAborted = false;
const hungCoordinator = new CloudSyncCoordinator<TestSession>((session) => session.user.id, (state) => { if (state === "sync-failed") hungAborted = true; }, 15);
hungCoordinator.request(sessionA, "hung", async (_session, signal) => await new Promise<never>((_resolve, reject) => signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true })));
await new Promise((resolve) => setTimeout(resolve, 30));
assert.equal(hungAborted, true, "The operation watchdog must settle a hung sync as failed.");

const staleStates: string[] = [];
let releaseStale: (() => void) | null = null;
const staleCoordinator = new CloudSyncCoordinator<TestSession>((session) => session.user.id, (state) => staleStates.push(state), 100);
const stale = staleCoordinator.request(sessionA, "stale", async (_session, _signal) => await new Promise<{ ok: true; fingerprint: string }>((resolve) => { releaseStale = () => resolve({ ok: true, fingerprint: "stale" }); }));
const sessionB: TestSession = { user: { id: "user-b" }, access_token: "token-b" };
const current = staleCoordinator.request(sessionB, "current", async () => ({ ok: true as const, fingerprint: "current" }));
releaseStale!();
await Promise.all([stale, current]);
assert.equal(staleStates.at(-1), "synced", "A stale operation must not overwrite the current operation status.");

console.log("Cloud sync request lifecycle tests passed: success, API failure, malformed response, timeout, and cancellation.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
