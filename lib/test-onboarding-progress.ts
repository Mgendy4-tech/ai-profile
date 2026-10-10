import assert from "node:assert/strict";
import { emptyCompanyData } from "./company-data";
import { deriveOnboardingProgress } from "./onboarding-progress";
import type { FamilyChoice } from "./authored-templates/family-selection";

const company = { ...emptyCompanyData, name: "Aurelia Interiors", about: "Residential interiors." };
const profile = { companyName: company.name, logoUrl: "", companyType: "Interior Design Studio", sections: [], about: "", expertise: [], experience: "", projects: [{ name: "Riverside", description: "Residence", imageUrl: "data:image/png;base64,AAA" }], reasons: [] };
const visualChoice = { id: "visual-portfolio", label: "Visual", description: "", eligible: true, recommended: true } satisfies FamilyChoice;
const ready = deriveOnboardingProgress({ company, projects: [{ id: "1", name: "Riverside", description: "Residence", imageUrl: "data:image/png;base64,AAA" }], profile, familyChoices: [visualChoice], selectedFamily: null });
assert(ready.every((step) => step.status === "ready"), "A fresh valid profile should be fully ready.");
const blocked = deriveOnboardingProgress({ company, projects: [{ id: "1", name: "Riverside", description: "Residence", imageUrl: "corrupt://image" }], profile, familyChoices: [{ ...visualChoice, eligible: false, recommended: false, reason: "Needs a valid project image." }] });
assert.equal(blocked.find((step) => step.id === "projects")?.status, "needs-attention");
assert(blocked.find((step) => step.id === "projects")?.detail.includes("valid project image"));
const firstTime = deriveOnboardingProgress({ company: null, projects: [], profile: null });
assert.equal(firstTime[0].status, "needs-attention"); assert.equal(firstTime[2].status, "not-generated");
console.log("Onboarding progress derivation tests passed.");
