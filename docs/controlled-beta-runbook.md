# Controlled External Beta Runbook

This runbook covers the existing `visual-portfolio`, `corporate-services`, and `product-tech` authored families. It does not authorize new families or template changes.

## Before inviting users

1. Configure `OPENAI_API_KEY` as a server-only environment variable. Configure `PEXELS_API_KEY` if contextual imagery in the standard PDF path is required; that path degrades to image-free behavior when visual selection fails. Never prefix either variable with `NEXT_PUBLIC_`.
2. Run:
   - `npx tsx lib/authored-templates/test-three-family-architecture.ts`
   - `npx tsx lib/authored-templates/test-beta-corpus.ts`
   - `npx tsx lib/authored-templates/test-real-user-beta.ts`
   - `npx tsx lib/test-export-beta-lifecycle.ts`
   - `npx tsc --noEmit`
   - `npm run build`
3. Start the production build locally with `npm start`. Smoke-test one image-backed portfolio company, one service company without projects, and one product company without projects. Confirm each download opens and every page is A4.
4. Smoke-test a deliberately unsupported section ID. Confirm a PDF still downloads through the standard professional layout and no routing diagnostics appear in the UI.

## During beta

For each export issue, record only the time, success/failure, export reference ID (when shown), whether a download began, approximate page count, and—using internal bounded events only—the authored family or standard-layout outcome. Do not copy company/profile text, project names or descriptions, emails, uploaded image data URLs, API keys, raw API responses, or browser local-storage dumps into tickets.

The current repository has no persistent telemetry backend. Development events appear only in the development console. For a deployed controlled beta, the smallest future production sink is a server endpoint or an already-approved hosting log/analytics facility that accepts the exact bounded `ExportEvent` schema; perform a privacy review before enabling it.

## If export fails

1. Ask for the export reference ID and approximate timestamp—not source content.
2. Reproduce with a sanitized fixture where possible.
3. Inspect only the coarse lifecycle outcome and bounded fallback diagnostics (`stage`, stable `code`, and `pageRole`).
4. Never ask users to send API keys, full local storage, private images, or sensitive company content publicly.
5. After correcting a defect, rerun the complete authored suite, beta corpus, real-user-beta matrix, TypeScript, and production build.

## Data/privacy operating notes

- `companyData` in browser `localStorage` contains company name, about, activities, experience, and a logo data URL when uploaded.
- `projectsData` contains project IDs, names, categories, descriptions, and uploaded image data URLs.
- `profileStructure` contains company data, generated structure analysis, and selected sections. The final generated profile is React state and is not separately persisted by the current Generate page.
- Local storage is persistent browser-origin storage, not secure storage. It survives browser restarts until the user/site/browser clears it; there is no application logout lifecycle in this repository.
- PDFs are generated client-side with jsPDF and downloaded directly. The application does not upload or persist generated PDFs.

## Rollback

There are no database migrations. Revert the deployment to the last known-good checkpoint and rebuild. Relevant checkpoints are `e6a52bda64e1097093e6f24d2e9d7fdee2db8118` (beta classifier/corpus), `2b544db5341c1a444d8cb007f00dd31f038fe8b7` (production integration), `5cbf27e9bd97a1538068e117b60fec816f972d89` (three-family gate), `c3394dd8dc630775510c9106ec917b78eaaff594` (Product/Tech), and `a711f67dc0f79e6bb7356bd8fa04c0ff2fc80854` (Corporate/Services). The Real User Beta validation checkpoint is recorded in the phase report.
