import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { authPathFor, safeNextPath, authPageDestination } from "./auth-redirect";

assert.equal(safeNextPath("/company"), "/company");
assert.equal(safeNextPath("/generate?source=company"), "/generate?source=company");
assert.equal(safeNextPath("https://evil.example/"), "/company");
assert.equal(safeNextPath("//evil.example/"), "/company");
assert.equal(authPathFor("/company"), "/auth?next=%2Fcompany");

const home = readFileSync("app/components/homepage-showcase.tsx", "utf8");
const auth = readFileSync("app/auth/auth-shell.tsx", "utf8");
const authPage = readFileSync("app/auth/page.tsx", "utf8");
const proxy = readFileSync("proxy.ts", "utf8");
const betaMode = readFileSync("lib/beta-test-mode.ts", "utf8");

assert(home.includes("AuthGatedLink"));
assert(home.includes('href="/auth"') && home.includes("Sign in"));
assert(!home.includes("Open account"));
assert(!home.includes("Guest mode") && !home.includes("Start as a guest") && !home.includes("Sign in to sync"));
assert(auth.includes("authPageDestination") && auth.includes("redirectAfterAuthentication"));
assert(auth.includes("Create account") && auth.includes("Sign in"));
assert(!auth.includes("auth-floating-panel") && !auth.includes("Guest mode") && !auth.includes("Sign in to sync"));
assert(authPage.includes("Create a private workspace") && authPage.includes("Existing local workspace data"));
for (const route of ["/company", "/projects", "/generate", "/export", "/workspace"]) assert(proxy.includes(`"${route}"`), `Auth proxy missing ${route}`);
for (const route of ["/api/analyze-brand", "/api/analyze-structure", "/api/generate-profile", "/api/plan-pdf-layout", "/api/select-visuals", "/api/visual-direction"]) {
  assert(proxy.includes(`"${route}"`), `Paid AI API route must be behind the auth proxy: ${route}`);
}
assert(proxy.includes("protectedAiApiPaths.has(pathname)") && proxy.includes("unauthorizedApi()"),
  "Unauthenticated paid AI requests must receive HTTP 401, never call external providers.");
assert(proxy.includes("getUser()") && proxy.includes("NEXT_PUBLIC_BETA_TEST_MODE"));
assert(proxy.includes("isLocalQaFixtureRequest") && betaMode.includes("x-lnkdit-qa-fixture") && betaMode.includes("localhost"), "Beta mode must be restricted to an explicit loopback QA fixture request.");
assert(proxy.includes('pathname === "/beta-test"') && proxy.includes('matcher: ["/beta-test"'), "The beta harness route must not be public on a beta-enabled Preview.");
assert(!proxy.includes("if (isBetaTestModeEnabled(process.env.NEXT_PUBLIC_BETA_TEST_MODE)) return NextResponse.next()"), "Beta mode must never bypass private-route authentication globally.");

console.log("Account-first authentication gate tests passed.");

assert.equal(authPageDestination(""), "/", "Ordinary sign-in must open the homepage instead of an account-status dead end.");
assert.equal(authPageDestination("?next=%2Fcompany"), "/company", "Create-profile entry must retain its requested destination.");
assert.equal(authPageDestination("?next=https%3A%2F%2Fevil.example"), "/");
assert.equal(authPageDestination("?mode=reset&next=%2Fcompany"), null, "Recovery must not be redirected to profile creation.");
assert.equal(authPageDestination("?code=example&mode=reset"), null);
assert.equal(authPageDestination("", "#type=recovery&access_token=example"), null);
