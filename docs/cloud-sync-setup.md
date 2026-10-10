# Preview cloud sync setup

This milestone uses Supabase Auth plus Postgres with row-level security. Run `supabase/schema.sql` in the Supabase SQL editor, then add these variables to the Vercel Preview/Development environments only:

```text
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

The anon key is the browser-safe Supabase public key; never put a service-role key in `NEXT_PUBLIC_*` or in client code. Production is intentionally not configured by this milestone.

Signed-in sync prefers the authenticated cloud snapshot after a successful read. A guest workspace migrates once per account/browser only when that account has no cloud profiles. Local data is retained after migration. If the same browser later signs in as another account, the previous account's local state is not migrated; the second account's cloud snapshot becomes authoritative.

Project/logo data URLs are retained locally and reported as unsupported assets in V1 rather than silently uploading or corrupting large database rows. Metadata and text state still sync safely; full object-storage image sync remains a follow-up.
