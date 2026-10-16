-- LNKDIT launch gate: read-only live Supabase security checks.
-- Safe to run repeatedly. No customer content, emails, user IDs or asset names are returned.
-- status PASS means the gate is satisfied; WARN means remediation is still required.
WITH checks AS (
  SELECT 'private_asset_bucket'::text AS gate,
    EXISTS (
      SELECT 1 FROM storage.buckets
      WHERE id = 'customer-assets' AND public IS FALSE
        AND file_size_limit = 10485760
        AND allowed_mime_types @> ARRAY['image/png','image/jpeg']::text[]
    ) AS passed
  UNION ALL SELECT 'profiles_rls_enabled',
    (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.cloud_profiles'::regclass)
  UNION ALL SELECT 'workspaces_rls_enabled',
    (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.cloud_workspaces'::regclass)
  UNION ALL SELECT 'anon_cannot_execute_rls_trigger',
    NOT has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE')
  UNION ALL SELECT 'authenticated_cannot_execute_rls_trigger',
    NOT has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE')
  UNION ALL SELECT 'anon_cannot_select_profiles',
    NOT has_table_privilege('anon', 'public.cloud_profiles', 'SELECT')
  UNION ALL SELECT 'anon_cannot_select_workspaces',
    NOT has_table_privilege('anon', 'public.cloud_workspaces', 'SELECT')
  UNION ALL SELECT 'profiles_owner_policy_optimized',
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'cloud_profiles'
        AND policyname = 'profile owner access'
        AND roles = ARRAY['authenticated']::name[]
        AND qual LIKE '%( SELECT auth.uid() AS uid)%'
    )
  UNION ALL SELECT 'workspaces_owner_policy_optimized',
    EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'cloud_workspaces'
        AND policyname = 'workspace owner access'
        AND roles = ARRAY['authenticated']::name[]
        AND qual LIKE '%( SELECT auth.uid() AS uid)%'
    )
  UNION ALL SELECT 'storage_owner_path_consistent',
    NOT EXISTS (
      SELECT 1 FROM storage.objects
      WHERE bucket_id = 'customer-assets'
        AND (storage.foldername(name))[1] IS DISTINCT FROM owner_id
    )
)
SELECT gate, CASE WHEN passed THEN 'PASS' ELSE 'WARN' END AS status
FROM checks
ORDER BY gate;
