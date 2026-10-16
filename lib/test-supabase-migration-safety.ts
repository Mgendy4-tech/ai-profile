import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const customer = readFileSync(join(process.cwd(), "supabase/customer-ready-v1.sql"), "utf8");
const hardening = readFileSync(join(process.cwd(), "supabase/security-hardening-v1.sql"), "utf8");

assert(!/alter\s+table\s+storage\.objects\s+enable\s+row\s+level\s+security\s*;/i.test(customer),
  "Never ALTER Supabase-owned storage.objects to enable RLS; Supabase manages it.");
assert(/alter\s+table\s+public\.cloud_profiles\s+enable\s+row\s+level\s+security/i.test(customer));
assert(/alter\s+table\s+public\.cloud_workspaces\s+enable\s+row\s+level\s+security/i.test(customer));
assert(/public\s*=\s*false/i.test(customer), "Customer assets must remain private.");
assert(/auth\.uid\(\)/i.test(customer), "Owner-scoped storage and profile policies are required.");
assert(/revoke\s+execute\s+on\s+function\s+public\.rls_auto_enable\(\)\s+from\s+public,\s*anon,\s*authenticated/i.test(hardening),
  "SECURITY DEFINER event-trigger function must not be callable by browser roles.");
for (const policy of ["workspace owner access", "profile owner access"]) {
  assert(hardening.includes(`ALTER POLICY "${policy}"`), `Missing optimized owner policy: ${policy}`);
}
assert(/using\s*\(\(select auth\.uid\(\)\)\s*=\s*user_id\)/i.test(hardening),
  "Owner policy should use a cached auth.uid() expression.");
assert(/revoke\s+all\s+privileges\s+on\s+table\s+public\.cloud_workspaces,\s*public\.cloud_profiles\s+from\s+anon/i.test(hardening),
  "Anonymous role must not retain direct access to private cloud tables.");
const liveAudit = readFileSync(join(process.cwd(), "supabase/launch-security-audit-readonly.sql"), "utf8");
for (const gate of [
  "private_asset_bucket", "profiles_rls_enabled", "workspaces_rls_enabled",
  "anon_cannot_execute_rls_trigger", "authenticated_cannot_execute_rls_trigger",
  "anon_cannot_select_profiles", "anon_cannot_select_workspaces",
  "profiles_owner_policy_optimized", "workspaces_owner_policy_optimized",
  "storage_owner_path_consistent",
]) {
  assert(liveAudit.includes(gate), `Missing read-only live audit gate: ${gate}`);
}
assert(!/\\b(?:insert|update|delete|alter|drop|truncate|revoke|grant)\\s+(?:into\\s+|table\\s+|policy\\s+|on\\s+)?(?:public|storage)[.]/i.test(liveAudit),
  "Read-only security audit must not mutate live database tables or policies.");
assert(customer.includes("using ((select auth.uid()) = user_id)"),
  "Base Supabase migration must preserve optimized cached owner checks.");
assert(customer.includes("(storage.foldername(name))[1] = (select auth.uid())::text"),
  "Base storage policies must preserve optimized cached owner checks.");
const isolationAudit = readFileSync(join(process.cwd(), "supabase/verify-owner-isolation-readonly.sql"), "utf8");
assert.equal((isolationAudit.match(/BEGIN READ ONLY;/g) ?? []).length, 2,
  "A/B RLS checks must each run inside a read-only transaction.");
assert.equal((isolationAudit.match(/ROLLBACK;/g) ?? []).length, 2,
  "A/B RLS checks must leave the database unchanged.");
assert.equal((isolationAudit.match(/SET LOCAL ROLE authenticated;/g) ?? []).length, 2,
  "Both A and B checks must execute as authenticated rather than postgres.");
assert(isolationAudit.includes("request.jwt.claim.sub"),
  "The read-only audit must simulate JWT subject under authenticated RLS.");
assert(isolationAudit.includes("simulated_account"),
  "The A/B audit must label the simulated direction.");
const storageIsolationAudit = readFileSync(join(process.cwd(), "supabase/verify-storage-isolation-readonly.sql"), "utf8");
assert.equal((storageIsolationAudit.match(/BEGIN READ ONLY;/g) ?? []).length, 2,
  "Storage owner A/B checks must run inside read-only transactions.");
assert.equal((storageIsolationAudit.match(/ROLLBACK;/g) ?? []).length, 2,
  "Storage owner A/B checks must leave customer objects untouched.");
assert.equal((storageIsolationAudit.match(/SET LOCAL ROLE authenticated;/g) ?? []).length, 2,
  "Storage owner A/B checks must use the authenticated RLS role.");
assert(storageIsolationAudit.includes("request.jwt.claim.sub") && storageIsolationAudit.includes("storage_owner_isolation"),
  "Storage audit must simulate owner JWT claims and report isolation results.");
console.log("Supabase migration safety checks passed.");
