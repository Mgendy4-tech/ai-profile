# LNKDIT controlled customer launch

## Verified evidence

- Production: https://www.lnkdit.com, production branch `main`, deployed application commit `81b202879fb39cb3b0dd039677b55127b297a1a0` (2026-10-18).
- Real customer journeys: GitHub Actions run 39127541544, reviewed source `8fcbf1d714e4c929b588b7627bf456f21d123c8f`.
- Real AI analysis and generation, PDF download, fresh browser cloud restore and second PDF export passed for visual-portfolio (155658 bytes), corporate-services (14318 bytes) and product-tech (12336 bytes). These are test fixtures, not customer content.
- Live production release verification: run [39129839344](https://github.com/Mgendy4-tech/ai-profile/actions/runs/39129839344) passed against https://www.lnkdit.com. Chromium and WebKit login/contrast/navigation/recovery guards passed; two-to-one-to-zero deletion remained empty after reload and fresh login; private support isolation, reply protection and daily cap passed. Real AI + fresh-browser restored PDF export passed for visual-portfolio (155615 bytes), corporate-services (14010 bytes), product-tech (12279 bytes).
- QA/security/TypeScript/production build and homepage Chromium/WebKit checks: run 39129839306 passed. The earlier WebKit navigation race was corrected by awaiting rendered company navigation in the test; the earlier homepage prefetch/reload error did not recur in the complete successful rerun. No browser errors were suppressed.
- Password recovery query/hash/expired-link guards have passed. Actual inbox delivery and the full email-link-to-new-password journey remain unverified.

## Incident monitoring

`LNKDIT Production Availability` checks readiness, public pages and anonymous AI protection every 30 minutes. GitHub executes scheduled workflows from the default branch (`main`), and the workflow is now present on `main`. Production check run 39129275161 passed after activation. Failed checks create a failed Actions run with a short incident summary. Repository owners should enable GitHub Actions failure notifications; email delivery of those notifications is not asserted here.

For a failure: inspect readiness, then Vercel runtime `[observability]` events. Record only timestamp, code, route, status and request/reference ID. Never paste tokens, support messages, company narratives or uploaded images into a public issue. Roll back to a previously verified deployment only if the new release caused the incident.

## Private support

Customers open `/support` from the footer, sign in and submit a subject and message. Their requests and replies are private to their account. Authenticated users cannot write an administrator reply or status. A maximum of five retained requests in a rolling 24-hour period is enforced by an invoker-security insert trigger using an advisory transaction lock, alongside the account ownership RLS policy. A customer can remove their own support data through the data API.

The owner reviews open requests in Supabase's `support_requests` table. Reply by editing only the selected request's `reply` and `status` (`answered` or `closed`). Never request passwords or confidential company documents. No response-time promise or email notification is implemented.

## Backups: prepared, not configured

The Supabase organization is currently Free. No downloadable automatic database backup or successful real restore has been verified. Do not mark this gate complete based on the encryption test.

A disabled, dedicated database role `lnkdit_backup_readonly` has read-all-data permissions and RLS bypass for complete dumps, with read-only sessions by default. It has NOLOGIN until the owner configures a strong password through a secure administrator session. Do not reuse an unrelated project's database credentials.

Configure these GitHub Actions secrets directly in the repository settings:

- `LNKDIT_BACKUP_DATABASE_URL`: the Supabase session-pooler or direct connection for `lnkdit_backup_readonly`, matching project `yeplwaainflckcrjsauw`, with SSL required.
- `LNKDIT_BACKUP_KEY`: a unique random key of at least 32 characters; retain a separate secure copy outside GitHub, because losing it makes backups unrecoverable.
- `SUPABASE_BACKUP_SERVICE_ROLE_KEY`: the server-only key for downloading private storage objects. Never expose this through `NEXT_PUBLIC_` or use it in browser application code.

The manually invoked `LNKDIT Encrypted Backup` workflow dumps application/auth/storage/private schemas and downloads the bytes from the private `customer-assets` bucket. Database backups alone do not contain those image bytes. Plaintext temporary files are removed, and only an AES-256-GCM encrypted archive and checksum are uploaded, retained for 14 days. Each run decrypts and byte-compares the archive before upload. The encryption implementation also rejects wrong keys and tampering in automated tests.

This is an application backup, not a complete Supabase project clone: keep migrations in Git, and record auth/SMTP/provider settings separately without placing credentials in the repo. A consistent maintenance window should be used for a final recovery drill because database and storage exports are not a single atomic snapshot.

Before enabling a daily schedule, make one real backup and restore it into a separate Supabase test project using the official Supabase backup/restore procedure. Verify account sign-in, profile counts, private image checksums, ownership isolation and PDF export. Never run a restore against Production as a test. The backup workflow must be pinned to a reviewed script commit before credentials are enabled.

## Remaining external gates

1. Dashboard inspection confirmed custom SMTP is OFF. Resend account creation is prepared at the Terms review screen; no integration has been installed and no terms accepted. Complete provider Terms acceptance, choose only its free plan, verify a sending domain, configure SMTP securely, test actual delivery to a disposable inbox and complete the same-browser password reset. Signup confirmation is currently unverified and should only be enabled after delivery works.
2. Signed-in Vercel dashboard confirmed Hobby. Official Vercel terms restrict Hobby to personal/non-commercial use; free access for customers does not itself make a business project eligible. Choose eligible hosting before customer launch. Pro is advertised at $20/month plus usage and applicable tax; no paid upgrade is authorized at an unspecified price. Render free services sleep after 15 idle minutes and take about a minute to restart, so they have not been selected or deployed as a production replacement.
3. Configure the backup secrets and complete the isolated recovery drill above.
4. Invite 5–10 customers only after these gates are closed. Keep the customer trial free; payment integration is a later milestone.
