import { validateGeneratedProfileSections, type GeneratedProfileSection } from "./generated-profile-boundary";
import { addApprovedServiceItem, addApprovedStructuredItem, deleteApprovedServiceItem, editApprovedSection, editApprovedServiceItem, moveApprovedServiceItem, validateApprovedStructure, type EditableProfileStructure } from "./profile-structure-editor";
import { isolateNewCompanyState } from "./profile-state-isolation";
import { validateAnalyzedProfileStructure } from "./profile-structure-boundary";

const assert: (condition: unknown, message?: string) => asserts condition = (condition, message = "Assertion failed") => { if (!condition) throw new Error(message); };
let structure: EditableProfileStructure = { companyType: "Business Consulting & Advisory Services", recommendedSections: [
  { id: "about", displayTitle: "About Northbridge Advisory", description: "Approved company narrative." },
  { id: "services", displayTitle: "Consulting & Advisory Services", description: "Approved source-backed service intent.", semanticRole: "services", items: [] },
] };
const editedSection = editApprovedSection(structure, "about", { displayTitle: "About Northbridge", description: "Edited approved narrative instruction." });
assert(editedSection.valid); structure = editedSection.structure;
assert(structure.recommendedSections[0].description === "Edited approved narrative instruction.", "Section title and description edits must persist in the approved structure.");

for (const [title, description] of [["Operations", "Improve operations"], ["Strategy", "Clarify strategic priorities"], ["Management", "Build effective management processes"]]) {
  const added = addApprovedServiceItem(structure, "services", { title, description }); assert(added.valid); structure = added.structure;
}
const originalIds = structure.recommendedSections[1].items!.map((item) => item.id);
const editedItem = editApprovedServiceItem(structure, "services", originalIds[1], { title: "Strategic Priorities", description: "Clarify strategic priorities with leadership teams" });
assert(editedItem.valid); structure = editedItem.structure;
structure = moveApprovedServiceItem(structure, "services", originalIds[1], -1);
assert(structure.recommendedSections[1].items![0].id === originalIds[1], "Reordering must preserve the stable item ID.");
structure = deleteApprovedServiceItem(structure, "services", originalIds[2]);
assert(structure.recommendedSections[1].items!.length === 2 && !structure.recommendedSections[1].items!.some((item) => item.id === originalIds[2]), "Delete must remove only the selected stable item.");
assert(validateApprovedStructure(structure) === null, "The edited structure must remain valid.");

let capacity = structure;
while (capacity.recommendedSections[1].items!.length < 12) {
  const count = capacity.recommendedSections[1].items!.length + 1;
  const added = addApprovedServiceItem(capacity, "services", { title: `Service ${count}`, description: "Approved service intent" }); assert(added.valid); capacity = added.structure;
}
const thirteenth = addApprovedServiceItem(capacity, "services", { title: "Service 13", description: "Approved service intent" });
assert(!thirteenth.valid && thirteenth.error.includes("12"), "The editor must reject a thirteenth service without truncation.");
const overlong = editApprovedServiceItem(structure, "services", originalIds[0], { title: "Operational Improvement Consulting", description: "Improve operations" });
assert(!overlong.valid && overlong.error.includes("28"), "Editor title validation must match the generation boundary.");

const approved = structure.recommendedSections;
const generated: GeneratedProfileSection[] = approved.map((section) => ({ id: section.id, title: section.displayTitle, description: section.description, content: "Source-backed content.", items: section.id === "services" ? section.items!.map((item) => ({ id: item.id, name: item.title, description: item.description, sourceEvidence: item.description })) : [] }));
const boundary = validateGeneratedProfileSections(approved, generated, { serviceSourceMaterial: [] });
assert(boundary.valid, "Approved service edits must pass the same generation contract with stable reordered IDs.");

const isolated = isolateNewCompanyState({ name: "Previous Company", logoUrl: "data:old-logo" }, { name: "Northbridge Advisory", logoUrl: "data:old-logo" }, [{ id: "old-project" }], false);
assert(isolated.companyChanged && isolated.projects.length === 0 && isolated.companyData.logoUrl === "" && isolated.clearKeys.includes("profileStructure"), "A new company must not inherit logo, projects, generated profile, or structure state.");
const retained = isolateNewCompanyState({ name: "Previous Company", logoUrl: "data:old-logo" }, { name: "Northbridge Advisory", logoUrl: "data:new-logo" }, [], true);
assert(retained.companyData.logoUrl === "data:new-logo", "An explicitly selected new logo must be retained.");
const corporateAnalysis = validateAnalyzedProfileStructure({ companyType: "Business consulting firm", recommendedSections: structure.recommendedSections });
assert(corporateAnalysis.valid, "A supported Corporate analyzed structure must pass before approval.");
const unsupportedCorporateAnalysis = validateAnalyzedProfileStructure({ companyType: "Business consulting firm", recommendedSections: [...structure.recommendedSections, { id: "whyChoose", displayTitle: "Why choose us", description: "Unsupported required marketing content." }] });
assert(!unsupportedCorporateAnalysis.valid && unsupportedCorporateAnalysis.diagnostics.some((entry) => entry.code === "unknown_semantic_role"), "Unsupported Corporate analysis must fail explicitly before user approval rather than reaching export fallback.");
let productStructure: EditableProfileStructure = { companyType: "B2B SaaS Platform", recommendedSections: [{ id: "about", displayTitle: "About Nodi", description: "Product overview." }, { id: "features", displayTitle: "Platform Capabilities", description: "Source-backed capabilities.", items: [] }] };
for (const [title, description] of [["Workflow Organization", "organize operational workflows"], ["Process Centralization", "centralize recurring processes"]]) { const added = addApprovedStructuredItem(productStructure, "features", { title, description }); assert(added.valid); productStructure = added.structure; }
assert(validateAnalyzedProfileStructure(productStructure).valid && validateApprovedStructure(productStructure) === null, "Supported Product structure and edited features must validate.");
const productGenerated: GeneratedProfileSection[] = productStructure.recommendedSections.map((section) => ({ id: section.id, title: section.displayTitle, description: section.description, content: "Source-backed product content.", items: section.items?.map((item) => ({ id: item.id, name: item.title, description: item.description, sourceEvidence: item.description })) ?? [] }));
assert(validateGeneratedProfileSections(productStructure.recommendedSections, productGenerated, { productSourceMaterial: [] }).valid, "Approved Product feature items must pass the shared generation boundary.");

console.log("Profile structure editor, persistence shape, capacity, stable ID, and state isolation tests passed.");
