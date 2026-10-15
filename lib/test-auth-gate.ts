import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { authPathFor, safeNextPath } from "./auth-redirect";

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
assert(auth.includes("safeNextPath") && auth.includes("redirectAfterAuthentication"));
assert(auth.includes("Create account") && auth.includes("Sign in"));
assert(!auth.includes("auth-floating-panel") && !auth.includes("Guest mode") && !auth.includes("Sign in to sync"));
assert(authPage.includes("Create a private workspace") && authPage.includes("Existing local workspace data"));
for (const route of ["/company", "/projects", "/generate", "/export", "/workspace"]) assert(proxy.includes(`"${route}"`), `Auth proxy missing ${route}`);
assert(proxy.includes("getUser()") && proxy.includes("NEXT_PUBLIC_BETA_TEST_MODE"));
assert(proxy.includes("isLocalQaFixtureRequest") && betaMode.includes("x-lnkdit-qa-fixture") && betaMode.includes("localhost"), "Beta mode must be restricted to an explicit loopback QA fixture request.");
assert(proxy.includes('pathname === "/beta-test"') && proxy.includes('matcher: ["/beta-test"'), "The beta harness route must not be public on a beta-enabled Preview.");
assert(!proxy.includes("if (isBetaTestModeEnabled(process.env.NEXT_PUBLIC_BETA_TEST_MODE)) return NextResponse.next()"), "Beta mode must never bypass private-route authentication globally.");

console.log("Account-first authentication gate tests passed.");
