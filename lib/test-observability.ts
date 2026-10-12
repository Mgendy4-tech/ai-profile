import assert from "node:assert/strict";
import { resetServerObservabilityDedupe, setServerObservabilitySink, logServerFailure, type ServerObservabilityEvent } from "./server/observability";
import { safeFailureEvent } from "./observability";

const events: ServerObservabilityEvent[] = [];
setServerObservabilitySink((event) => { events.push(event); });
resetServerObservabilityDedupe();
logServerFailure({ category: "cloud_sync_failure", code: "storage token should not appear!", surface: "workspace", route: "/api/cloud/workspace?token=secret", status: 503 });
logServerFailure({ category: "cloud_sync_failure", code: "storage token should not appear!", surface: "workspace", route: "/api/cloud/workspace?token=secret", status: 503 });
assert.equal(events.length, 1, "duplicate events must be suppressed");
assert.equal(events[0].route, "/api/cloud/workspace");
assert.equal(events[0].code, "storage_token_should_not_appear_");
assert(!JSON.stringify(events[0]).includes("secret"));
assert.equal(safeFailureEvent({ category: "auth_failure", code: "invalid_credentials", surface: "auth", source: "client" }).source, "client");
setServerObservabilitySink(null);
console.log("Privacy-safe observability and duplicate suppression tests passed.");
