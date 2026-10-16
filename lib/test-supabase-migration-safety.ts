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
console.log("Supabase migration safety checks passed.");
