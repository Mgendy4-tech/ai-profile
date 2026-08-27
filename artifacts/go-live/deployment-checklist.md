# Deployment checklist

## Required configuration

- Set server-only `OPENAI_API_KEY`.
- Set server-only `PEXELS_API_KEY`.
- Do not define `NEXT_PUBLIC_OPENAI_API_KEY` or `NEXT_PUBLIC_PEXELS_API_KEY`.
- Run `npm run readiness`; it reports presence only and never values.
- With a running deployment, set `READINESS_BASE_URL=https://deployment.example` and run `npm run readiness` again.

## Runtime and network

- Deploy as a Node.js-compatible Next.js 16.3.2 application.
- Permit outbound HTTPS to OpenAI and Pexels.
- Confirm the host supports dynamic App Router handlers and browser-generated file downloads.
- Ensure request limits accept 256 KiB JSON generation requests.
- Keep the frozen V1 project/image/page/PDF limits unchanged.

## Build and security

- Run `npm ci`, `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
- Verify `/api/health/readiness` returns 200 without secret values.
- Inspect client assets for secret values/names before promotion.
- Configure CSP/connect-src for the application, OpenAI/Pexels server calls, and approved image origins as applicable.
- Serve only over HTTPS.

## Telemetry adapter

`lib/production-telemetry.ts` defines `ProductionTelemetryAdapter`. Connect a log/metrics backend by installing an adapter at server/client bootstrap. The default is a no-op and failures are swallowed so monitoring cannot break generation or export. Never enrich events with company identity, prose, generated content, image data, provider payloads, keys, or stack traces.

## Release

- Run `SMOKE_BASE_URL=https://deployment.example npm run smoke:post-deploy` with Playwright available through `NODE_PATH`.
- Confirm one authored PDF for each family and no legacy markers.
- Confirm Clear local data removes only application-owned keys and stays cleared after refresh.
- Enable alerts for external API failures, model contract rejection rate, expected fallback rate, export failures, latency, and PDF size.
- Record the deployed commit/build identifier outside this uncommitted workspace.
