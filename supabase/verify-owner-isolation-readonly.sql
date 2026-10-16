-- LNKDIT: live RLS owner isolation smoke test, without test passwords.
-- Uses two distinct existing profile owners but returns no names, IDs, or content.
-- Read-only transaction. The role is switched to authenticated and JWT sub is
-- simulated; this validates Postgres RLS, not a real Auth/API browser session.
-- Run the two transactions independently; each should show PASS for all checks.

BEGIN READ ONLY;
SELECT set_config('lnkdit.audit_a',(SELECT user_id::text FROM public.cloud_profiles ORDER BY user_id LIMIT 1),true),
       set_config('lnkdit.audit_b',(SELECT user_id::text FROM public.cloud_profiles ORDER BY user_id OFFSET 1 LIMIT 1),true);
SELECT set_config('request.jwt.claim.sub',current_setting('lnkdit.audit_a'),true);
SET LOCAL ROLE authenticated;
SELECT 'A' AS simulated_account,
       CASE WHEN auth.uid() = current_setting('lnkdit.audit_a')::uuid
             AND (SELECT count(*) FROM public.cloud_profiles WHERE user_id=current_setting('lnkdit.audit_a')::uuid)>0
             AND (SELECT count(*) FROM public.cloud_profiles WHERE user_id=current_setting('lnkdit.audit_b')::uuid)=0
             AND (SELECT count(*) FROM public.cloud_workspaces WHERE user_id=current_setting('lnkdit.audit_a')::uuid)>0
             AND (SELECT count(*) FROM public.cloud_workspaces WHERE user_id=current_setting('lnkdit.audit_b')::uuid)=0
       THEN 'PASS' ELSE 'FAIL' END AS owner_isolation;
ROLLBACK;

BEGIN READ ONLY;
SELECT set_config('lnkdit.audit_a',(SELECT user_id::text FROM public.cloud_profiles ORDER BY user_id LIMIT 1),true),
       set_config('lnkdit.audit_b',(SELECT user_id::text FROM public.cloud_profiles ORDER BY user_id OFFSET 1 LIMIT 1),true);
SELECT set_config('request.jwt.claim.sub',current_setting('lnkdit.audit_b'),true);
SET LOCAL ROLE authenticated;
SELECT 'B' AS simulated_account,
       CASE WHEN auth.uid() = current_setting('lnkdit.audit_b')::uuid
             AND (SELECT count(*) FROM public.cloud_profiles WHERE user_id=current_setting('lnkdit.audit_b')::uuid)>0
             AND (SELECT count(*) FROM public.cloud_profiles WHERE user_id=current_setting('lnkdit.audit_a')::uuid)=0
             AND (SELECT count(*) FROM public.cloud_workspaces WHERE user_id=current_setting('lnkdit.audit_b')::uuid)>0
             AND (SELECT count(*) FROM public.cloud_workspaces WHERE user_id=current_setting('lnkdit.audit_a')::uuid)=0
       THEN 'PASS' ELSE 'FAIL' END AS owner_isolation;
ROLLBACK;
