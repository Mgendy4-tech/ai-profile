# Controlled External Beta Readiness Audit

## Export UX before hardening

- Idle: enabled `Download PDF` button; no export status.
- Started: button disabled and labeled `Exporting...`; no separate honest status text.
- Authored/standard success: `PDF downloaded successfully.`
- Failure: project-image-oriented error shown in the same green message treatment as success.
- Repeat: React state guard only; same-tick calls were not atomically locked.
- Download: client-side `jsPDF.save`.
- Development diagnostics: bounded authored routing decision in a `NODE_ENV !== production` console debug. No technical diagnostics were rendered in the UI.

## Export UX after hardening

- Immediate status: `Creating your company profile…`
- Atomic duplicate guard covers same-tick attempts and resets in `finally`.
- Authored and standard success: `Your company profile is ready.`
- Failure: `We couldn't create your PDF this time. Please try again. Reference: EXP-…` with error styling and retry through the same button.
- Previous status is replaced at the start of every attempt.

## Privacy and security findings

- Browser storage keys are `companyData`, `projectsData`, and `profileStructure`. Company narrative, project metadata, logo data URLs, and project-image data URLs can persist across browser restarts. There is no logout/session-clearing feature. Local storage is not secure storage.
- `OPENAI_API_KEY` and `PEXELS_API_KEY` are referenced only from server routes/server-side modules and are not `NEXT_PUBLIC_` values. No authored-template code contains credentials. `.env*` and `.vercel` are gitignored.
- API error logging is server-side. Development-only authored routing logging contains mode, pack ID, stage, stable code, path, and page role; it does not contain source content or image bytes. The new event boundary deliberately omits paths.
- PDFs are generated and downloaded in the browser; no PDF upload or persistence path was found.
- Structure analysis and profile generation send supplied company/project text (but not project image bytes) to OpenAI. Brand analysis, visual direction, and layout planning can send company/profile/layout inputs to OpenAI on the standard export path. Contextual image search sends generated search concepts to Pexels; uploaded project images remain local during authored PDF generation.

## Observability and deployment

- Events: `EXPORT_STARTED`, `EXPORT_COMPLETED`, and `EXPORT_FAILED`.
- Bounded fields: random event ID, timestamp, duration, coarse outcome/failure category, authored family ID, page count, and fallback stage/code/page role.
- Prohibited/absent fields: names, profile text, project metadata, images/data URLs, emails, uploads, arbitrary source strings, ranking scores, paths, and stack traces.
- No persistent telemetry backend exists. Production sink is intentionally a no-op; development has a structured console sink. A reviewed bounded server/hosting sink remains an operational option, not an implemented dependency.
- Repository configuration is a standard Next.js application linked locally to Vercel; no provider-specific production configuration was added. Browser-only export code remains under a `use client` boundary.
- Test fixtures and beta reports are not imported by production runtime. Authored routing and the legacy fallback remain in the single Generate export handler.
