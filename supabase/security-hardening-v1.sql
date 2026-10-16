-- LNKDIT security hardening (review before applying to the live Supabase project).
-- Non-destructive: no user data, storage objects, or tables are deleted.
-- The rls_auto_enable() event trigger runs as its owner during DDL and
-- does not need direct RPC EXECUTE access from browser-facing roles.
-- This fixes the public SECURITY DEFINER function warning.
DO $$
BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

-- Optimize owner checks: cache auth.uid() once per statement rather than
-- re-evaluating it for each row. These ALTER POLICY statements keep the
-- existing policy names and do not modify customer data.
ALTER POLICY "workspace owner access" ON public.cloud_workspaces
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

ALTER POLICY "profile owner access" ON public.cloud_profiles
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Separate dashboard action required:
-- Supabase > Authentication > Settings > Password security:
-- enable leaked-password protection, if supported by the project's plan.
-- No SQL change can safely substitute for that Auth service setting.

-- After applying, re-run Supabase Security Advisor and verify:
-- select has_function_privilege('anon', 'public.rls_auto_enable()', 'EXECUTE');
-- select has_function_privilege('authenticated', 'public.rls_auto_enable()', 'EXECUTE');
-- Both should return false.
