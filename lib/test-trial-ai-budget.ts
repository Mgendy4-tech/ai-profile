import assert from "node:assert/strict";
import { reserveTrialAiRequest } from "./trial-ai-budget";
async function run() {
  assert.equal(await reserveTrialAiRequest(async () => ({ data: true, error: null })), "allowed");
  assert.equal(await reserveTrialAiRequest(async () => ({ data: false, error: null })), "limited");
  assert.equal(await reserveTrialAiRequest(async () => ({ data: true, error: new Error("offline") })), "unavailable");
  assert.equal(await reserveTrialAiRequest(async () => ({ data: "true", error: null })), "unavailable");
  assert.equal(await reserveTrialAiRequest(async () => { throw new Error("offline"); }), "unavailable");
  console.log("Trial AI budget permits valid reservations and fails closed on quota or database failure.");
}
void run();
