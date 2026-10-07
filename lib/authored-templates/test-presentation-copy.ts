import assert from "node:assert/strict";
import { containsGeneratedFillerCopy, containsInternalPresentationCopy, customerFacingItemDescription, customerFacingSectionCopy, customerFacingSectionDescription, customerFacingSectionLine } from "./presentation-copy";
import { familyChoices } from "./family-selection";

const company = { name: "Aurelia Interiors", companyType: "Interior Design Studio", industry: "Interior Design", about: "Customer wording may explicitly say based on supplied information." };
const filler = { name: "Interior Design", description: "Interior Design grounded in supplied information." };
const explicit = { name: "Research", description: "based on supplied information" };

assert.equal(customerFacingItemDescription("visual-portfolio", company, filler), "Design capability within Aurelia Interiors' practice.");
assert.equal(customerFacingItemDescription("corporate-services", company, explicit), explicit.description, "Explicit customer-entered wording must not be filtered.");
assert.equal(customerFacingSectionLine("visual-portfolio", company, [filler]), "Aurelia Interiors' Interior Design Studio · Interior Design practice.");
assert.equal(containsInternalPresentationCopy("Present the seven supplied capabilities."), true);
assert.equal(containsInternalPresentationCopy("We present thoughtful interiors."), false);
assert.equal(containsGeneratedFillerCopy(filler.description), true);
const presented = customerFacingSectionCopy("visual-portfolio", company, { title: "Capabilities", description: "Present the supplied capabilities.", content: "A source-backed design practice.", items: [filler] });
assert(!containsGeneratedFillerCopy(presented.description) && !containsGeneratedFillerCopy(presented.content), "Customer-facing section copy must remove generated filler.");
assert(presented.content.includes("Aurelia Interiors") && presented.items[0].description.includes("Design capability"), "Personalized presentation must retain source facts.");
const aureliaPreviewSections = [
  { title: "Residential Expertise", description: "Describe Aurelia's supplied residential expertise.", content: "Residential expertise grounded in warm natural materials, functional planning, and calm neutral palettes.", items: [] },
  { title: "Design Approach", description: "Describe the supplied material-led design approach.", content: "A calm, material-led approach grounded in the supplied company and project information.", items: [] },
  { title: "Selected Projects", description: "Present Riverside Residence using its supplied project record.", content: "Riverside Residence is the supplied completed residential project.", items: [{ name: "Riverside Residence", description: "A contemporary residential interior shaped through warm natural materials and a calm neutral palette." }] },
  { title: "Interior Design Capabilities", description: "Present the seven supplied interior design capabilities.", content: "Seven source-backed interior design capabilities.", items: [{ name: "Interior Design", description: "Interior Design for source-backed residential interiors." }] },
].map((section) => customerFacingSectionCopy("visual-portfolio", { ...company, activities: "interior design, space planning, material selection, furniture selection, lighting design, styling, and project coordination" }, section));
const aureliaPreviewText = aureliaPreviewSections.map((section) => [section.title, section.description, section.content, ...section.items.map((item) => `${item.name} ${item.description}`)].join("\n")).join("\n");
for (const forbidden of ["Describe ", "supplied residential expertise", "supplied material-led", "grounded in the supplied", "supplied company and project information"]) {
  assert(!aureliaPreviewText.toLocaleLowerCase().includes(forbidden.toLocaleLowerCase()), `Aurelia customer-facing preview must not contain ${forbidden}.`);
}
assert(aureliaPreviewText.includes("Riverside Residence") && aureliaPreviewText.includes("Interior Design"), "Aurelia project and capability names must remain intact in customer-facing preview.");
assert(!customerFacingSectionDescription(company, "Residential Expertise", "Describe Aurelia's supplied residential expertise.").includes("supplied"), "Planner descriptions must normalize internal instructions without changing source data.");
const northbridgePresented = customerFacingSectionCopy("corporate-services", { name: "Northbridge Advisory", companyType: "Business Consulting & Professional Services" }, { title: "Advisory Services", description: "Present the supplied services.", content: "Northbridge provides source-backed advisory services.", items: [{ name: "Operational Improvement", description: "Operational Improvement grounded in supplied company information." }] });
assert(northbridgePresented.content.includes("Northbridge Advisory") && northbridgePresented.items[0].description.includes("Advisory capability") && !containsGeneratedFillerCopy(northbridgePresented.content), "Northbridge copy must remain advisory and source-grounded without internal filler.");
const winxPresented = customerFacingSectionCopy("product-tech", { name: "WinX", companyType: "Sales Technology Company" }, { title: "Platform Features", description: "Present the supplied product features.", content: "WinX provides source-backed platform capabilities.", items: [{ name: "Campaign Management", description: "Campaign Management based on supplied product information." }] });
assert(winxPresented.content.includes("WinX") && winxPresented.items[0].description.includes("Platform capability") && !containsGeneratedFillerCopy(winxPresented.content), "WinX copy must remain product-focused without internal filler.");
const entered = { name: "Research", description: "The client explicitly wrote source-backed in this description." };
const enteredCopy = customerFacingSectionCopy("visual-portfolio", { ...company, about: entered.description }, { title: "Research", description: entered.description, content: entered.description, items: [entered] });
assert.equal(entered.description, "The client explicitly wrote source-backed in this description.", "User-entered source text must remain unchanged.");
assert.equal(enteredCopy.items[0].description, entered.description, "Literal user-entered wording must remain customer-visible.");
const aureliaChoices = familyChoices({ projectCount: 1, authenticProjectImageCount: 1, serviceCount: 7, productFeatureCount: 0, useCaseCount: 0 });
const northbridgeChoices = familyChoices({ projectCount: 0, authenticProjectImageCount: 0, serviceCount: 5, productFeatureCount: 0, useCaseCount: 0 });
const winxChoices = familyChoices({ projectCount: 0, authenticProjectImageCount: 0, serviceCount: 0, productFeatureCount: 7, useCaseCount: 3 });
assert.equal(aureliaChoices.find((choice) => choice.recommended)?.id, "visual-portfolio");
assert.equal(northbridgeChoices.find((choice) => choice.recommended)?.id, "corporate-services");
assert.equal(winxChoices.find((choice) => choice.recommended)?.id, "product-tech");
assert(aureliaChoices.find((choice) => choice.recommended)?.recommendationReason?.includes("authentic imagery"));
console.log("Customer-facing authored presentation-copy boundary tests passed.");
