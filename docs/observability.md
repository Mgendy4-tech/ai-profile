# Production observability

The app records bounded, privacy-safe failure events for auth, cloud sync, private asset upload/hydration, profile generation, PDF export, browser runtime errors, and server/API failures.

Events contain only a stable category, short code, surface, route path, status, timestamp, and a server-generated request ID. They never include email addresses, company/profile content, image data, passwords, access tokens, prompts, raw provider responses, or stack traces.

Server events are emitted as structured `[observability]` JSON to the hosting platform's server logs. Duplicate category/code/surface/route/status events are suppressed for 60 seconds. Client events are sent to `POST /api/telemetry` and use the same dedupe window; failures in the monitoring path are deliberately ignored so monitoring cannot break the product.

No external provider is required for this milestone. To connect one later, implement `ServerObservabilitySink` in `lib/server/observability.ts`, register it in the server startup/instrumentation layer, and keep the same privacy contract. Do not forward raw request bodies or provider payloads.

Operational follow-up:

1. Choose an error-monitoring provider and create the account outside this repository.
2. Add only its server-side DSN/token as a hosting secret.
3. Register the sink in server startup and verify auth, sync, upload, generation, export, and runtime test events in a non-Production Preview.
4. Configure retention and access so logs are limited to the engineering team.
