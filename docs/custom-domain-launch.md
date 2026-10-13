# Custom domain and auth recovery launch

This release prepares the app for a custom production domain but does not add or promote one. Recovery links use the current browser origin, which keeps Preview independent. `NEXT_PUBLIC_SITE_URL` is an optional canonical fallback for non-browser contexts and should be set only to the active public origin for the environment.

## Exact setup order

1. **Add the domain in Vercel.** Open the project **Settings → Domains** and add the intended production hostname.
2. **Configure DNS.** Create the exact A, CNAME, or verification records Vercel shows for that domain. Do not substitute values from another project.
3. **Verify the domain.** Wait for Vercel verification and HTTPS certificate issuance. Confirm the final hostname loads over HTTPS.
4. **Set production `NEXT_PUBLIC_SITE_URL`.** Set it in the Vercel Production environment to the final `https://` origin, without a path, query, or fragment. Preview may omit it because recovery prefers the current Preview origin.
5. **Update the Supabase Site URL.** In **Authentication → URL Configuration**, set **Site URL** to the final production origin.
6. **Add Preview and Production redirect URLs.** Add the final production recovery route (`https://CUSTOM_DOMAIN/auth?mode=reset`), the current Preview recovery route (`https://PREVIEW_HOST/auth?mode=reset`), and keep the known-good Vercel production recovery route during rollback validation.
7. **Validate the recovery email.** Request a reset from the custom domain and confirm the email link returns to the custom domain's `/auth?mode=reset` route.
8. **Smoke auth, settings, privacy, and terms.** Verify sign-in, sign-out, password reset, the Account/Settings page, and both legal links on desktop and mobile widths.
9. **Rollback if needed.** Restore the previous Supabase Site URL and redirect allow-list, remove or disable the bad canonical env value, and direct customers to the known-good Vercel production URL while the custom domain is corrected.

## Configuration contract

- `NEXT_PUBLIC_SITE_URL` is optional and must be an origin such as `https://profile.example.com`.
- Only `http` and `https` origins without credentials, paths, query strings, or fragments are accepted.
- In a browser, the current origin wins over the configured value so Preview auth and cloud sync remain isolated from Production.
- If no safe origin is available, the recovery helper falls back to the relative route `/auth?mode=reset`; Supabase should still be configured with the absolute URLs above.

## Supabase recovery checks

Confirm the Supabase email template uses the standard recovery action and that the redirect allow-list contains every environment being tested. The app handles expired, reused, and invalid recovery tokens with customer-safe messages; raw provider errors must remain server-side/observability-only.

## Rollback detail

Do not deploy Production as part of this preparation. For a failed cutover, leave the Vercel project and known-good deployment available, restore Supabase Site URL and redirects to the last known-good values, revert `NEXT_PUBLIC_SITE_URL` to the prior origin or unset it, and repeat the recovery smoke test before attempting the domain again.
