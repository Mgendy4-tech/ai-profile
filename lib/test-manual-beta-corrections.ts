import assert from "node:assert/strict";
import { experienceDurationLabel, experienceValidationMessage } from "./company-data";
import { validateGeneratedProfileSections } from "./generated-profile-boundary";
import { generatedProjectEvidenceCount, persistGeneratedProfile, readPersistedGeneratedProfile, type PersistedGeneratedProfile } from "./generated-profile-storage";
import { authoredExportPolicyCode, mustBlockLegacyFallback } from "./authored-export-policy";

const stored = new Map<string, string>();
const storage = { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => { stored.set(key, value); } };
const profile: PersistedGeneratedProfile = {
  companyName: "Aurelia Interiors", companyType: "Interior Design Studio", about: "Source-backed overview.", expertise: [], experience: "8", reasons: [],
  sections: [{ id: "projects", title: "Selected Projects", description: "Source-backed work.", content: "Source-backed project section.", items: [{ id: "projects:project:1", name: "Riverside Residence", description: "Source-backed residence." }] }],
  projects: [{ name: "Riverside Residence", description: "Source-backed residence." }],
};
persistGeneratedProfile(storage, profile);
stored.set("projectsData", "[]");
const reloaded = readPersistedGeneratedProfile(storage);
assert(reloaded, "The generated profile must survive the browser serialization/reload boundary.");
const evidence = { persistedProjectCount: 0, generatedProjectCount: generatedProjectEvidenceCount(reloaded) };
assert.deepEqual(evidence, { persistedProjectCount: 0, generatedProjectCount: 1 });
assert.equal(authoredExportPolicyCode(evidence), "project_state_generated_only");
assert.equal(mustBlockLegacyFallback(evidence), true);

for (const value of ["", "0", "1", "12"]) assert.equal(experienceValidationMessage(value), null, `${JSON.stringify(value)} must be accepted.`);
assert.equal(experienceValidationMessage("-2"), "Years of Experience must be 0 or greater.");
assert.equal(experienceDurationLabel("0"), "0 years");
assert.equal(experienceDurationLabel("1"), "1 year");
assert.equal(experienceDurationLabel("12"), "12 years");

const selected = [{ id: "about", displayTitle: "About", description: "Overview" }];
const grammar = validateGeneratedProfileSections(selected, [{ id: "about", title: "About", description: "Overview", content: "With 1 years of experience, the company advises clients.", items: [] }], { experienceYears: "1" });
assert(grammar.valid && grammar.sections[0].content.includes("1 year of experience") && !grammar.sections[0].content.includes("1 years"), "The generated boundary must deterministically correct singular experience grammar.");

console.log("Manual-beta generated-only safety, experience validation, and grammar tests passed.");
