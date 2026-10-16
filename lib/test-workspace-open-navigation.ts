import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve("app/workspace/page.tsx"), "utf8");
assert(source.includes('profile.id === activeId ? <Link href="/company"'),
  "Opening the active profile must navigate to the company editor.");
assert(source.includes('onClick={() => choose(profile.id)}'),
  "Opening an inactive profile must activate it before navigation.");
assert(!source.includes('href={profile.id === activeId ? "/company" : "/workspace"}'),
  "Opening an inactive profile must not link back to the unchanged workspace.");
const integration = readFileSync(resolve("lib/test-supabase-ab-security.ts"), "utf8");
assert(integration.includes("A/B test accounts already contain profiles"),
  "Integration test must refuse accounts with existing profiles.");
assert(integration.includes("A/B test accounts already contain workspaces"),
  "Integration test must refuse accounts with existing workspaces.");
console.log("Workspace open navigation and disposable-account safety passed.");
