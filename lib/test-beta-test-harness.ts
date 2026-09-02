import assert from "node:assert/strict";
import { betaFixtureImageState, createBetaFixture, loadBetaFixture, type BetaFixtureId } from "./beta-test-fixtures";
import { isBetaTestModeEnabled } from "./beta-test-mode";
import { APPLICATION_STORAGE_KEYS, clearApplicationLocalData } from "./local-profile-data";
import { generatedProjectEvidenceCount, readPersistedGeneratedProfile } from "./generated-profile-storage";

assert.equal(isBetaTestModeEnabled(undefined), false); assert.equal(isBetaTestModeEnabled("false"), false); assert.equal(isBetaTestModeEnabled("true"), true);
const values = new Map<string, string>([["unrelated-origin-state", "keep"]]); const writes: string[] = [];
const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { writes.push(key); values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
const image = "data:image/png;base64,QUJD";
const load = (id: BetaFixtureId) => { writes.length = 0; const fixture = createBetaFixture(id, image); loadBetaFixture(storage as Storage, fixture); assert(writes.every((key) => (APPLICATION_STORAGE_KEYS as readonly string[]).includes(key)), `${id} wrote a non-application storage key.`); return fixture; };

const aurelia = load("aurelia"); const aureliaProjects = JSON.parse(values.get("projectsData")!); const aureliaGenerated = readPersistedGeneratedProfile(storage);
assert.equal(aurelia.company.experience, "8"); assert.equal(aurelia.generatedProfile.sections.find((section) => section.id === "services")?.items.length, 7); assert.equal(aureliaProjects[0].name, "Riverside Residence"); assert.equal(betaFixtureImageState(aureliaProjects), "valid_data_url"); assert(aureliaGenerated && generatedProjectEvidenceCount(aureliaGenerated) === 1);
const northbridge = load("northbridge"); assert.equal(northbridge.company.experience, "1"); assert.equal(northbridge.projects.length, 0); assert.equal(northbridge.generatedProfile.sections.find((section) => section.id === "services")?.items.length, 5); assert(northbridge.generatedProfile.sections.some((section) => section.id === "howItWorks"));
const winx = load("winx"); assert.equal(winx.projects.length, 0); assert(winx.generatedProfile.sections.some((section) => section.id === "features") && winx.generatedProfile.sections.some((section) => section.id === "useCases"));
const missing = load("aurelia-missing-image"); assert.equal(missing.projects.length, 1); assert.equal(betaFixtureImageState(missing.projects), "missing_or_corrupt"); assert.equal(generatedProjectEvidenceCount(missing.generatedProfile), 1);
const generatedOnly = load("aurelia-generated-only"); assert.equal(JSON.parse(values.get("projectsData")!).length, 0); assert.equal(generatedProjectEvidenceCount(generatedOnly.generatedProfile), 1); assert.match(generatedOnly.expectedSafetyOutcome, /project_state_generated_only/);
const legacy = load("legacy-control"); assert.equal(legacy.projects.length, 0); assert.equal(generatedProjectEvidenceCount(legacy.generatedProfile), 0); assert.equal(legacy.expectedFamily, "legacy");
const cleared = clearApplicationLocalData(storage as Storage); assert(cleared.complete && APPLICATION_STORAGE_KEYS.every((key) => !values.has(key))); assert.equal(values.get("unrelated-origin-state"), "keep");
console.log("Preview-only beta QA harness fixture and isolation tests passed.");
