# Custom production domain launch

This release does not add a domain. The app uses the browser's current origin for password recovery links, so auth links do not depend on a Vercel hostname. Keep `NEXT_PUBLIC_SITE_URL` optional until a canonical-domain policy is chosen; do not hardcode a deployment URL in application code.

## Vercel

1. Add the chosen domain in the Vercel project under **Settings → Domains**.
2. Use the DNS records Vercel provides. Usually the apex uses an A record and a subdomain uses a CNAME; use the exact values shown for the project.
3. Wait for Vercel certificate issuance and verify both HTTPS and the final redirect policy.
4. Keep the existing Vercel URL available during rollout for rollback.

## Supabase

1. In **Authentication → URL Configuration**, set **Site URL** to the final HTTPS domain.
2. Add the final domain's `/auth` URL to **Redirect URLs**.
3. Keep the current Preview URL in the allow-list while validating Preview.
4. Remove temporary URLs only after recovery and sign-in have been manually verified.

## Recovery validation

1. Request a password reset from the final domain.
2. Confirm the email link opens `/auth?mode=reset` on the final domain, not a Vercel hostname.
3. Set a new password, sign in, and confirm cloud sync.
4. Repeat once in a private browser session.

## Rollback

If the domain or auth callback is incorrect, leave the Vercel domain attached but direct customers to the known-good Vercel URL, restore Supabase Site URL/Redirect URLs to the last known-good values, and re-test recovery before trying the domain again. Do not promote a Production deployment during a domain rollback.
