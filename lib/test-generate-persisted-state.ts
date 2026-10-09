import assert from "node:assert/strict";
import { createBetaFixture, loadBetaFixture } from "./beta-test-fixtures";
import { companySemanticText, readPersistedCompanyData } from "./company-data";
import { familyChoices } from "./authored-templates/family-selection";
import { createGeneratedProfileSourceFingerprint, generatedProjectEvidenceCount, isPersistedGeneratedProfileCurrent, readPersistedGeneratedProfile } from "./generated-profile-storage";
import { APPLICATION_STORAGE_KEYS, clearApplicationLocalData } from "./local-profile-data";
import { persistedImageState, readPersistedProjects } from "./persisted-projects";
import { validateAuthoredImageOperationalLimits } from "./production-limits";

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
assert(isPersistedGeneratedProfileCurrent({ ...generated, sourceFingerprint: createGeneratedProfileSourceFingerprint(savedCompany, fixture.projects) }, savedCompany, fixture.projects), "Aurelia generated state must match its persisted source snapshot.");
assert(!isPersistedGeneratedProfileCurrent({ ...generated, sourceFingerprint: createGeneratedProfileSourceFingerprint({ ...savedCompany, about: "Changed source" }, fixture.projects) }, savedCompany, fixture.projects), "Changed company source must invalidate generated state.");
values.set("projectsData", "{malformed");
assert(readPersistedGeneratedProfile(storage) && readPersistedProjects(storage).issues.length === 1, "Malformed project storage must be isolated from generated-profile persistence.");

clearApplicationLocalData(storage as Storage);
const missingFixture = createBetaFixture("aurelia-missing-image", "data:image/png;base64,QUJD");
loadBetaFixture(storage as Storage, missingFixture);
const missingCompany = readPersistedCompanyData(storage);
const missingProjects = readPersistedProjects(storage).projects;
const missingProfile = readPersistedGeneratedProfile(storage);
assert(missingCompany && missingProjects.length === 1 && missingProfile, "The missing-image fixture must preserve the company, project, and generated evidence envelopes.");
assert.equal(persistedImageState(missingProjects[0]?.imageUrl), "invalid", "The missing-image fixture must persist an invalid source image rather than a valid fallback.");
assert(validateAuthoredImageOperationalLimits(missingCompany, missingProjects).some((issue) => issue.code === "image_format_limit"), "Current-source export validation must reject the invalid project image.");
assert(!isPersistedGeneratedProfileCurrent(missingProfile, missingCompany, [{ ...missingProjects[0], imageUrl: "data:image/png;base64,QUJD" }]), "A generated profile cannot make an invalid current source image valid again.");

clearApplicationLocalData(storage as Storage);
loadBetaFixture(storage as Storage, fixture);
const staleCompany = readPersistedCompanyData(storage);
const staleProfile = readPersistedGeneratedProfile(storage);
values.set("projectsData", JSON.stringify([{ ...fixture.projects[0], imageUrl: "corrupt://removed" }]));
const staleProjects = readPersistedProjects(storage).projects;
assert(staleCompany && staleProfile && !isPersistedGeneratedProfileCurrent(staleProfile, staleCompany, staleProjects), "Removing a current source image must invalidate an older generated profile.");
assert.equal(persistedImageState(staleProjects[0]?.imageUrl), "invalid", "Stale-state checks must observe the current invalid source image.");

clearApplicationLocalData(storage as Storage);
assert.equal(readPersistedCompanyData(storage), null, "Empty storage must remain an absent-company state.");
assert(APPLICATION_STORAGE_KEYS.every((key) => !values.has(key)), "Empty-state cleanup must remove only application-owned keys.");

console.log("Focused /generate persisted-company state regression passed.");
