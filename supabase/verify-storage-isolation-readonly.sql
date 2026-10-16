-- LNKDIT: private customer-assets Storage RLS isolation in both directions.
-- Uses two existing distinct asset owners as simulated authenticated JWT subjects.
-- Read-only: does not read asset bytes, modify objects, or reveal user identifiers.
-- This validates database RLS only; the separate live A/B API test remains required.

BEGIN READ ONLY;
SELECT 'configured' AS fixture WHERE
  set_config('lnkdit.asset_a', (
    SELECT split_part(name, '/', 1) FROM storage.objects
    WHERE bucket_id = 'customer-assets' ORDER BY name LIMIT 1
  ), true) IS NOT NULL
  AND set_config('lnkdit.asset_b', (
    SELECT split_part(name, '/', 1) FROM storage.objects
    WHERE bucket_id = 'customer-assets'
      AND split_part(name, '/', 1) <> (
        SELECT split_part(name, '/', 1) FROM storage.objects
        WHERE bucket_id = 'customer-assets' ORDER BY name LIMIT 1
      )
    ORDER BY name LIMIT 1
  ), true) IS NOT NULL;
SELECT 'configured' AS jwt WHERE set_config('request.jwt.claim.sub', current_setting('lnkdit.asset_a'), true) IS NOT NULL;
SET LOCAL ROLE authenticated;
SELECT 'A' AS simulated_account,
  CASE WHEN auth.uid()::text = current_setting('lnkdit.asset_a')
    AND (SELECT count(*) FROM storage.objects WHERE bucket_id = 'customer-assets'
      AND split_part(name, '/', 1) = current_setting('lnkdit.asset_a')) > 0
    AND (SELECT count(*) FROM storage.objects WHERE bucket_id = 'customer-assets'
      AND split_part(name, '/', 1) = current_setting('lnkdit.asset_b')) = 0
  THEN 'PASS' ELSE 'FAIL' END AS storage_owner_isolation;
ROLLBACK;

BEGIN READ ONLY;
SELECT 'configured' AS fixture WHERE
  set_config('lnkdit.asset_a', (
    SELECT split_part(name, '/', 1) FROM storage.objects
    WHERE bucket_id = 'customer-assets' ORDER BY name LIMIT 1
  ), true) IS NOT NULL
  AND set_config('lnkdit.asset_b', (
    SELECT split_part(name, '/', 1) FROM storage.objects
    WHERE bucket_id = 'customer-assets'
      AND split_part(name, '/', 1) <> (
        SELECT split_part(name, '/', 1) FROM storage.objects
        WHERE bucket_id = 'customer-assets' ORDER BY name LIMIT 1
      )
    ORDER BY name LIMIT 1
  ), true) IS NOT NULL;
SELECT 'configured' AS jwt WHERE set_config('request.jwt.claim.sub', current_setting('lnkdit.asset_b'), true) IS NOT NULL;
SET LOCAL ROLE authenticated;
SELECT 'B' AS simulated_account,
  CASE WHEN auth.uid()::text = current_setting('lnkdit.asset_b')
    AND (SELECT count(*) FROM storage.objects WHERE bucket_id = 'customer-assets'
      AND split_part(name, '/', 1) = current_setting('lnkdit.asset_b')) > 0
    AND (SELECT count(*) FROM storage.objects WHERE bucket_id = 'customer-assets'
      AND split_part(name, '/', 1) = current_setting('lnkdit.asset_a')) = 0
  THEN 'PASS' ELSE 'FAIL' END AS storage_owner_isolation;
ROLLBACK;
