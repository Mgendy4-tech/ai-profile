import {
  createStableCustomSectionId,
  persistApprovedProfileStructure,
  validateGeneratedProfileSections,
  type GeneratedProfileSection,
  type SelectedProfileSection,
} from "./generated-profile-boundary";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

const selected: SelectedProfileSection[] = [
  { id: "about", displayTitle: "About Northbridge Advisory", description: "Approved about description." },
  { id: "services", displayTitle: "Consulting & Advisory Services", description: "Approved services description." },
  { id: "custom-who-we-work-with", displayTitle: "Who We Work With", description: "Approved custom description." },
];
const generated = (id: string, title = selected.find((section) => section.id === id)?.displayTitle ?? "Unknown"): GeneratedProfileSection => ({
  id, title, description: "Generated description.", content: "Source-grounded generated content.", items: id === "services" ? [{ id: "services:service:1", name: "Advisory", description: "Source-grounded business advisory support.", sourceEvidence: "business advisory" }] : [],
});
const sourceContext = { serviceSourceMaterial: ["Northbridge provides business advisory support to leadership teams."] };

const valid = validateGeneratedProfileSections(selected, selected.map((section) => generated(section.id)), sourceContext);
assert(valid.valid && valid.sections.map((section) => section.id).join("|") === "about|services|custom-who-we-work-with", "Every selected section returned exactly once must be accepted unchanged.");

const reordered = validateGeneratedProfileSections(selected, [generated("custom-who-we-work-with"), generated("about"), generated("services")], sourceContext);
assert(reordered.valid && reordered.sections.map((section) => section.id).join("|") === "about|services|custom-who-we-work-with", "Valid returned identities must be normalized to selected order.");

const missing = validateGeneratedProfileSections(selected, [generated("about"), generated("services")], sourceContext);
assert(!missing.valid && missing.diagnostics.some((entry) => entry.code === "generated_section_missing_id" && entry.sectionId === "custom-who-we-work-with"), "A missing selected section must be rejected explicitly.");

const duplicate = validateGeneratedProfileSections(selected, [generated("about"), generated("services"), generated("services")], sourceContext);
assert(!duplicate.valid && duplicate.diagnostics.some((entry) => entry.code === "generated_section_duplicate_id" && entry.sectionId === "services"), "A duplicate returned section must be rejected explicitly.");

const unknown = validateGeneratedProfileSections(selected, [generated("about"), generated("services"), generated("invented")], sourceContext);
assert(!unknown.valid && unknown.diagnostics.some((entry) => entry.code === "generated_section_unknown_id" && entry.sectionId === "invented"), "An unrequested returned section must be rejected explicitly.");

const malformed = validateGeneratedProfileSections(selected, [{ id: "about" }]);
assert(!malformed.valid && malformed.diagnostics[0].code === "generated_sections_invalid_shape", "The defensive client validator must refuse malformed API section data.");

assert(createStableCustomSectionId("Who We Work With", ["about", "services"]) === "custom-who-we-work-with", "Custom section IDs must be stable title-derived slugs.");
assert(createStableCustomSectionId("Who We Work With", ["custom-who-we-work-with", "custom-who-we-work-with-2"]) === "custom-who-we-work-with-3", "Custom ID collisions must use deterministic suffixes.");

let persisted = "";
const structure = { companyType: "Business advisory", recommendedSections: [...selected] };
const persistedSelection = persistApprovedProfileStructure({ setItem: (key, value) => { assert(key === "profileStructure", "Approved structure must use the existing persistence key."); persisted = value; } }, { name: "Northbridge Advisory" }, structure, selected.map((section) => section.id));
const parsed = JSON.parse(persisted) as { analysis: typeof structure; selectedSections: SelectedProfileSection[] };
assert(persistedSelection[2].id === "custom-who-we-work-with" && parsed.selectedSections[2].id === "custom-who-we-work-with", "A custom selected section must persist before generation.");

const editedStructure = { ...structure, recommendedSections: structure.recommendedSections.map((section) => section.id === "services" ? { ...section, displayTitle: "Edited Advisory Services" } : section) };
persistApprovedProfileStructure({ setItem: (_key, value) => { persisted = value; } }, {}, editedStructure, selected.map((section) => section.id));
const edited = JSON.parse(persisted) as { selectedSections: SelectedProfileSection[] };
assert(edited.selectedSections[1].displayTitle === "Edited Advisory Services", "An edited section title must persist in the final approved structure before generation.");
const itemEditedStructure = { ...editedStructure, recommendedSections: editedStructure.recommendedSections.map((section) => section.id === "services" ? { ...section, description: "Edited service instruction.", items: [{ id: "services:service:operations", title: "Operations", description: "Improve operations" }, { id: "services:service:strategy", title: "Strategy", description: "Clarify strategic priorities" }] } : section) };
persistApprovedProfileStructure({ setItem: (_key, value) => { persisted = value; } }, {}, itemEditedStructure, selected.map((section) => section.id));
const itemEdited = JSON.parse(persisted) as { selectedSections: SelectedProfileSection[] };
assert(itemEdited.selectedSections[1].description === "Edited service instruction." && itemEdited.selectedSections[1].items?.map((item) => item.id).join("|") === "services:service:operations|services:service:strategy", "Edited descriptions and ordered structured items must persist with stable IDs before generation.");

for (const count of [1, 2, 3, 4]) {
  const sections = selected.map((section) => section.id !== "services" ? generated(section.id) : {
    ...generated("services"),
    items: Array.from({ length: count }, (_, index) => ({
      id: `services:service:${index + 1}`,
      name: `Advisory service ${index + 1}`,
      description: "A source-grounded business advisory service description.",
      sourceEvidence: "business advisory",
    })),
  });
  assert(validateGeneratedProfileSections(selected, sections, sourceContext).valid, `A valid ${count}-item service section must be accepted.`);
}

const replaceServices = (items: GeneratedProfileSection["items"]) => selected.map((section) => section.id === "services" ? { ...generated("services"), items } : generated(section.id));
const emptyServices = validateGeneratedProfileSections(selected, replaceServices([]), sourceContext);
assert(!emptyServices.valid && emptyServices.diagnostics.some((entry) => entry.code === "generated_services_items_required"), "An empty services collection must be rejected at generation.");
const malformedServices = validateGeneratedProfileSections(selected, replaceServices([{ id: "services:service:1", name: "", description: "Description", sourceEvidence: "business advisory" }]), sourceContext);
assert(!malformedServices.valid && malformedServices.diagnostics.some((entry) => entry.code === "generated_service_item_invalid"), "Malformed service items must be rejected.");
const duplicateServiceIds = validateGeneratedProfileSections(selected, replaceServices([
  { id: "services:service:1", name: "First", description: "Source-backed business advisory.", sourceEvidence: "business advisory" },
  { id: "services:service:1", name: "Second", description: "Source-backed business advisory.", sourceEvidence: "business advisory" },
]), sourceContext);
assert(!duplicateServiceIds.valid && duplicateServiceIds.diagnostics.some((entry) => entry.code === "generated_service_item_duplicate_id"), "Duplicate service item IDs must be rejected.");
const unsupportedEvidence = validateGeneratedProfileSections(selected, replaceServices([{ id: "services:service:1", name: "Invented", description: "Unsupported service.", sourceEvidence: "certified transformation program" }]), sourceContext);
assert(!unsupportedEvidence.valid && unsupportedEvidence.diagnostics.some((entry) => entry.code === "generated_service_item_evidence_unsupported"), "Service provenance evidence must occur in supplied source material.");
const overlongServiceTitle = validateGeneratedProfileSections(selected, replaceServices([{ id: "services:service:1", name: "Operational Improvement Consulting", description: "Source-backed business advisory.", sourceEvidence: "business advisory" }]), sourceContext);
assert(!overlongServiceTitle.valid && overlongServiceTitle.diagnostics.some((entry) => entry.code === "generated_service_item_title_capacity_unsupported"), "A service title outside the fixed authored title capacity must fail before export.");
const overCapacity = validateGeneratedProfileSections(selected, replaceServices(Array.from({ length: 13 }, (_, index) => ({ id: `services:service:${index + 1}`, name: `Service ${index + 1}`, description: "Source-backed business advisory.", sourceEvidence: "business advisory" }))), sourceContext);
assert(!overCapacity.valid && overCapacity.diagnostics.some((entry) => entry.code === "generated_services_count_unsupported"), "Service input above the authored 1-12 capacity must reject without truncation.");
const nonService = validateGeneratedProfileSections([selected[0]], [generated("about")], sourceContext);
assert(nonService.valid && nonService.sections[0].items.length === 0, "Existing non-services sections must remain unchanged.");

const repeatedValid = validateGeneratedProfileSections(selected, selected.map((section) => generated(section.id)), sourceContext);
assert(JSON.stringify(valid) === JSON.stringify(repeatedValid), "Unchanged valid generation must remain accepted deterministically.");

console.log("Generated-profile section completeness boundary tests passed.");
