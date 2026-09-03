import assert from "node:assert/strict";
import { containsGeneratedFillerCopy, containsInternalPresentationCopy, customerFacingItemDescription, customerFacingSectionLine } from "./presentation-copy";

const company = { name: "Aurelia Interiors", companyType: "Interior Design Studio", industry: "Interior Design", about: "Customer wording may explicitly say based on supplied information." };
const filler = { name: "Interior Design", description: "Interior Design grounded in supplied information." };
const explicit = { name: "Research", description: "based on supplied information" };

assert.equal(customerFacingItemDescription("visual-portfolio", company, filler), "Part of Aurelia Interiors' design capabilities.");
assert.equal(customerFacingItemDescription("corporate-services", company, explicit), explicit.description, "Explicit customer-entered wording must not be filtered.");
assert.equal(customerFacingSectionLine("visual-portfolio", company, [filler]), "A coordinated view of the studio's design practice.");
assert.equal(containsInternalPresentationCopy("Present the seven supplied capabilities."), true);
assert.equal(containsInternalPresentationCopy("We present thoughtful interiors."), false);
assert.equal(containsGeneratedFillerCopy(filler.description), true);
console.log("Customer-facing authored presentation-copy boundary tests passed.");
