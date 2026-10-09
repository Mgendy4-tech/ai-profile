import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isBetaTestModeEnabled } from "./beta-test-mode";
import { validateProductionEnvironment } from "./server/production-environment";

assert.equal(isBetaTestModeEnabled(undefined), false);
assert.equal(isBetaTestModeEnabled("false"), false);
assert.equal(isBetaTestModeEnabled("true"), true);
const betaPage = readFileSync(resolve("app", "beta-test", "page.tsx"), "utf8");
assert(betaPage.includes("isBetaTestModeEnabled(process.env.NEXT_PUBLIC_BETA_TEST_MODE)"), "Beta mode must remain server-gated.");
for (const route of ["app/page.tsx", "app/company/page.tsx", "app/projects/page.tsx", "app/generate/page.tsx"]) {
  assert(!readFileSync(resolve(route), "utf8").includes("Load Aurelia"), `${route} must not expose beta fixture controls.`);
}
const environment = validateProductionEnvironment({ NODE_ENV: "production", OPENAI_API_KEY: "configured", PEXELS_API_KEY: "configured" });
assert(environment.ready && environment.accidentalClientExposure.length === 0, "Production safety environment must not expose server secrets to the client.");
console.log("Production safety and Preview-only beta gate tests passed.");
