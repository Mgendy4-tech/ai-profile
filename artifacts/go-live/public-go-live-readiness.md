# Final public go-live closure

Classification: **PUBLIC GO-LIVE READY PENDING DEPLOYMENT SMOKE**

All locally provable release blockers are closed without adding a family, redesigning a template, changing provenance, or increasing operational limits. A real deployment was explicitly out of scope, so deployed smoke evidence is the sole remaining promotion gate.

## Privacy and cleanup

A visible footer explains in plain language that company details, drafts, logos, and project images may remain in the browser and are not stored in a cloud account by this app. Clear local data requires an inline confirmation and removes only `companyData`, `projectsData`, `profileStructure`, `generatedProfile`, `authoredFamilyDecision`, and `exportDecision`. It returns to the initial route. Unit and Chrome/Edge tests prove deletion survives refresh and unrelated storage remains.

## Monitoring and errors

The typed fail-safe adapter emits model rejection/completion, structure rejection, family selection, expected fallback, export success/failure, and external API failure events. Events contain stable codes, family/pack, durations, counts, page count, and PDF bytes only. They cannot contain company names, prose, generated content, images, keys, raw provider responses, or stacks by contract/convention. With no adapter configured, telemetry is a no-op; synchronous and asynchronous adapter failures are swallowed.

Internal failure classes distinguish model contract rejection, expected authored incompatibility, operational limits, external API failure, export failure, and runtime/system failure. Production API responses remain actionable and redact raw diagnostics/provider output.

## Environment and deployment

`OPENAI_API_KEY` and `PEXELS_API_KEY` are the only required secrets. The validator reports presence, build mode, accidental `NEXT_PUBLIC_` exposure, and optional route reachability without values. `/api/health/readiness` is Node-runtime, uncached, and returns only safe presence metadata. Local readiness found both secrets, no public exposure, and all seven required routes reachable.

Next.js build/runtime assumptions, Node hosting, dynamic routes, external HTTPS, request sizes, downloads, and package scripts are documented in `deployment-checklist.md`. No local deployment blocker remains.

## Retry behavior

Contract rejection instructs the user to try generation again. The approved structure and edited item IDs remain persisted; profile state is not accepted, items are not appended, validation is unchanged, and export cannot begin from malformed output. The existing Generate Profile control remains available for a clean retry.

## Smoke and tests

The base-URL-configurable smoke harness passed Visual, Corporate, and Product authored downloads in Chrome and Edge, correct family/pack markers, no legacy markers, state replacement, cleanup, unrelated-key isolation, and refresh persistence. Its deterministic fixtures remove model variance. A deployed live-provider smoke remains required after deployment.

All generated-profile, structure/editor, persistence/isolation, limits, provenance, ranking, normalization, coverage, orchestration, three family, corpus, browser, privacy, telemetry, and environment gates pass. Lint has zero errors; TypeScript, production build, and diff checks pass. Existing unrelated lint warnings remain non-blocking.

## Remaining external actions

1. Deploy an identified build with the two required server secrets.
2. Run the configurable harness against the deployment.
3. Run one live OpenAI-backed case per family in the deployed environment.
4. Connect `ProductionTelemetryAdapter` to the selected monitoring backend and configure alerts.

IndexedDB or object storage remains optional at the frozen 3 MB combined browser-persistence limit. It is a later scalability enhancement, not a current release blocker.
