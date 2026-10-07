import assert from "node:assert/strict";
import { createBetaFixture, loadBetaFixture } from "./beta-test-fixtures";
import { companySemanticText, readPersistedCompanyData } from "./company-data";
import { familyChoices } from "./authored-templates/family-selection";
import { generatedProjectEvidenceCount, readPersistedGeneratedProfile } from "./generated-profile-storage";
import { APPLICATION_STORAGE_KEYS, clearApplicationLocalData } from "./local-profile-data";

const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { values.set(key, value); },
  removeItem: (key: string) => { values.delete(key); },
};

const fixture = createBetaFixture("aurelia", "data:image/png;base64,QUJD");
loadBetaFixture(storage as Storage, fixture);

const savedCompany = readPersistedCompanyData(storage);
assert(savedCompany && savedCompany.name === "Aurelia Interiors" && savedCompany.about, "Aurelia persisted company data must be ready for /generate analysis.");
assert.equal(companySemanticText(savedCompany).name, "Aurelia Interiors", "Analyze must use the canonical persisted company read.");

const generated = readPersistedGeneratedProfile(storage);
assert(generated && generatedProjectEvidenceCount(generated) === 1, "Aurelia persisted generated profile content must remain available after navigation.");
const choices = familyChoices({
  projectCount: fixture.projects.length,
  authenticProjectImageCount: fixture.projects.filter((project) => Boolean(project.imageUrl)).length,
  serviceCount: generated.sections.find((section) => section.id === "services")?.items.length ?? 0,
  productFeatureCount: generated.sections.find((section) => section.id === "features")?.items.length ?? 0,
  useCaseCount: generated.sections.find((section) => section.id === "useCases")?.items.length ?? 0,
});
assert.equal(choices.find((choice) => choice.recommended)?.id, "visual-portfolio", "Aurelia must retain the Visual / Portfolio recommendation.");
assert.equal(generated.projects[0]?.name, "Riverside Residence", "Aurelia project content must remain intact.");
assert(generated.sections.find((section) => section.id === "services")?.items.some((item) => item.name === "Interior Design"), "Aurelia capability names must remain intact.");

clearApplicationLocalData(storage as Storage);
assert.equal(readPersistedCompanyData(storage), null, "Empty storage must remain an absent-company state.");
assert(APPLICATION_STORAGE_KEYS.every((key) => !values.has(key)), "Empty-state cleanup must remove only application-owned keys.");

console.log("Focused /generate persisted-company state regression passed.");
