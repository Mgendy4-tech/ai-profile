# Preview cloud sync setup

Customer-ready V1 uses Supabase Auth, Postgres RLS, and a private Supabase Storage bucket. Run `supabase/customer-ready-v1.sql` manually in the Supabase SQL editor; do not auto-run it from the app. The migration is idempotent and non-destructive.

Add these variables to the Vercel Preview/Development environments while validating the release:

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

The anon key is the browser-safe Supabase public key; never put a service-role key in `NEXT_PUBLIC_*` or in client code. Production must receive the same two public Supabase variables only after the release gates pass. Keep `NEXT_PUBLIC_BETA_TEST_MODE` Preview-only.

Signed-in sync prefers the authenticated cloud snapshot after a successful read. A guest workspace migrates once per account/browser only when that account has no cloud profiles. Local data is retained after migration. If the same browser later signs in as another account, the previous account's local state is not migrated; the second account's cloud snapshot becomes authoritative.

Signed-in logo and project images upload to the private `customer-assets` bucket under `{user_id}/{profile_id}/...`; cloud profile rows store only asset paths. The browser hydrates short-lived signed URLs for display/export. Existing local/base64 images migrate on the next authenticated sync without deleting the local copy; failed uploads remain local and can be retried. Guest images remain browser-only.
