import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { validateGeneratedProfileSections, type GeneratedProfileSection, type SelectedProfileSection } from "../generated-profile-boundary";
import { validateDocumentCoverage } from "./coverage";
import { createContentShape, normalizeAuthoredContentUnits } from "./content-shape";
import { createCorporateServicesDocumentPlan, prepareCorporateServicesDocumentPlan } from "./corporate-services-planner";
import { routeEditorialInteriorsV1Export } from "./export-orchestrator";
import { rankAuthoredTemplateFamilies } from "./family-ranking";
import { authoredTemplateFamilies } from "./registry";
import { isCorporateServicesCompanyType, normalizeProductionSectionRoles } from "./section-role-normalization";
import { selectAuthoredCover } from "./cover-library";
import { containsGeneratedFillerCopy, containsInternalPresentationCopy } from "./presentation-copy";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => { if (!condition) throw new Error(message); };

const company = {
  name: "Northbridge Advisory",
  logoUrl: `data:image/png;base64,${readFileSync(resolve("lib/test-fixtures/logos/brand-wide-transparent.png")).toString("base64")}`,
  about: "Northbridge Advisory is a business consulting firm that helps growing companies improve operations, clarify strategic priorities, and build more effective management processes. The firm works closely with leadership teams to identify operational challenges, structure practical solutions, and support sustainable business growth.",
  activities: "Northbridge Advisory helps growing companies improve operations, clarify strategic priorities, and build more effective management processes.",
  experience: "The firm works closely with leadership teams to identify operational challenges, structure practical solutions, and support sustainable business growth.",
};

const selectedSections: SelectedProfileSection[] = [
  { id: "about", displayTitle: "About Northbridge Advisory", description: "Introduce Northbridge Advisory using the supplied company description." },
  { id: "services", displayTitle: "Consulting & Advisory Services", description: "Present only the consulting and advisory services supported by the supplied company information.", semanticRole: "services" },
  { id: "expertise", displayTitle: "Areas of Focus", description: "Describe the supplied operational, strategic-priority, and management-process focus areas." },
  { id: "howItWorks", displayTitle: "Our Advisory Approach", description: "Explain the supplied approach of working with leadership teams to identify challenges and structure practical solutions." },
  { id: "solutions", displayTitle: "Supporting Sustainable Growth", description: "Describe the supplied support for sustainable business growth without adding outcomes or claims." },
];

// Captured from the live /api/generate-profile request on 2026-08-27 and then
// passed through the same defensive boundary used by the React client.
const liveSections: GeneratedProfileSection[] = [
  { id: "about", title: "About Northbridge Advisory", description: selectedSections[0].description, content: "Northbridge Advisory is a business consulting firm that helps growing companies improve operations, clarify strategic priorities, and build more effective management processes. The firm works closely with leadership teams to address operational needs and support sustainable business growth.", items: [] },
  { id: "services", title: "Consulting & Advisory Services", description: selectedSections[1].description, content: "Northbridge Advisory provides consulting and advisory support focused on the operational, strategic, and management needs of growing companies.", items: [
    { id: "services:service:1", name: "Operational Improvement", description: "Consulting support designed to help growing companies improve operations by addressing their operational challenges.", sourceEvidence: "improve operations" },
    { id: "services:service:2", name: "Strategic Priorities", description: "Advisory support that works with leadership teams to clarify strategic priorities as companies grow.", sourceEvidence: "clarify strategic priorities" },
    { id: "services:service:3", name: "Management Processes", description: "Practical consulting support to help companies build more effective management processes alongside their leadership teams.", sourceEvidence: "build more effective management processes" },
    { id: "services:service:4", name: "Growth Advisory", description: "Advisory support structured to support sustainable business growth for growing companies.", sourceEvidence: "support sustainable business growth" },
    { id: "services:service:5", name: "Leadership Collaboration", description: "Advisory work conducted closely with leadership teams to identify operational challenges.", sourceEvidence: "leadership teams" },
  ] },
  { id: "expertise", title: "Areas of Focus", description: selectedSections[2].description, content: "Northbridge Advisory focuses on three connected areas: improving operations, clarifying strategic priorities, and building more effective management processes. These focus areas guide the firm's work with growing companies and their leadership teams.", items: [] },
  { id: "howItWorks", title: "Our Advisory Approach", description: selectedSections[3].description, content: "Northbridge Advisory works closely with leadership teams to identify operational challenges and structure practical solutions. This collaborative approach connects the firm's advisory work with the operational and management priorities of each growing company.", items: [] },
  { id: "solutions", title: "Supporting Sustainable Growth", description: selectedSections[4].description, content: "Northbridge Advisory supports sustainable business growth by helping growing companies strengthen operations, clarify strategic priorities, and develop more effective management processes. Its work is grounded in identifying operational challenges and structuring practical solutions with leadership teams.", items: [] },
];

const sourceMaterial = [company.about, company.activities, company.experience];
const main = async () => {
const boundary = validateGeneratedProfileSections(selectedSections, liveSections, { serviceSourceMaterial: sourceMaterial });
assert(boundary.valid, `Live response boundary failed: ${JSON.stringify(boundary.diagnostics)}`);
const profile = { companyName: company.name, companyType: "Business consulting firm", sections: boundary.sections };
const normalized = normalizeProductionSectionRoles(profile.sections, { corporateServices: isCorporateServicesCompanyType(profile.companyType) });
assert(normalized.diagnostics.length === 0, `Corporate normalization failed: ${JSON.stringify(normalized.diagnostics)}`);
const narrative = normalized.sections.find((entry) => entry.role === "narrative");
const services = normalized.sections.find((entry) => entry.role === "services");
const details = normalized.sections.filter((entry): entry is typeof entry & { role: "expertise" | "approach" | "supporting_narrative" } => entry.role === "expertise" || entry.role === "approach" || entry.role === "supporting_narrative");
assert(narrative && services, "Northbridge must normalize to narrative and services sources.");
const units = normalizeAuthoredContentUnits({ company: {}, sections: [
  { id: narrative.section.id, role: "narrative", content: narrative.section.content },
  { id: services.section.id, role: "services", items: services.section.items.map((_, index) => ({ id: `${services.section.id}:item:${index}` })) },
  ...details.map((entry) => ({ id: entry.section.id, role: entry.role, content: entry.section.content })),
], projects: [] });
const ranking = rankAuthoredTemplateFamilies(authoredTemplateFamilies, createContentShape(units, null, false));
assert(ranking[0]?.familyId === "corporate-services", `Corporate must rank first: ${JSON.stringify(ranking)}`);
const coverSelection = selectAuthoredCover({ familyId: "corporate-services", companyName: company.name, companyType: profile.companyType, hasLogo: false });
assert(coverSelection.compatible && coverSelection.templateId === "authored-cover-v1.corporate-clean", "Northbridge must select the clean authored cover.");
const planning = createCorporateServicesDocumentPlan({
  units,
  cover: { contentId: "company", documentLabel: "COMPANY PROFILE", companyName: company.name, companyType: profile.companyType, paletteId: coverSelection.paletteId }, coverTemplateId: coverSelection.templateId,
  narrative: { contentId: narrative.section.id, title: narrative.section.title, body: narrative.section.content, supportingLine: narrative.section.description },
  servicesHeading: services.section.title,
  servicesSupportingLine: services.section.description,
  services: services.section.items.map((item, index) => ({ contentId: `${services.section.id}:item:${index}`, index: String(index + 1).padStart(2, "0"), title: item.name, description: item.description })),
  details: details.map((entry) => ({ contentId: entry.section.id, title: entry.section.title, body: entry.section.content, supportingLine: entry.section.description })),
});
assert(planning.compatible, `Corporate planning failed: ${JSON.stringify(planning.issues)}`);
const coverage = validateDocumentCoverage(units, planning.plan);
assert(coverage.complete, `Corporate coverage failed: ${JSON.stringify(coverage.issues)}`);
assert(new Set(coverage.consumedContentIds).size === coverage.consumedContentIds.length, "Corporate content must not be consumed twice.");
const prepared = prepareCorporateServicesDocumentPlan(planning.plan);
assert(prepared.compatible, `Corporate preflight failed: ${JSON.stringify(prepared.issues)}`);

const input = { company, profile, projects: [] };
const decodeLogo = async () => ({ width: 480, height: 160 });
const first = await routeEditorialInteriorsV1Export(input, decodeLogo);
const second = await routeEditorialInteriorsV1Export(input, decodeLogo);
assert(first.mode === "authored" && second.mode === "authored", `Production orchestrator fell back: ${JSON.stringify(first.reasons)}`);
assert(first.familyId === "corporate-services" && first.packId === "corporate-services-v1", "Production orchestrator selected the wrong family or pack.");
assert(first.pageOrder[3] === "corporate-services-v1.services-continuation-1", "Northbridge must select the fixed one-item services continuation.");
const rawPages = (first.pdf.internal as unknown as { pages: string[][] }).pages;
const servicesPage = rawPages[3].join("\n"); const continuationPage = rawPages[4].join("\n");
assert(servicesPage.includes("Consulting") && servicesPage.includes("structured view"), "First services page must own the customer-facing section introduction.");
assert(continuationPage.includes("SERVICES / CONTINUED") && continuationPage.includes("Additional Services"), "Corporate continuation must use its compact authored treatment.");
assert(!continuationPage.includes("Consulting & Advisory Services") && !continuationPage.includes("structured view"), "Corporate continuation must not repeat the services title or description.");
assert(JSON.stringify(first.pageOrder) === JSON.stringify(planning.plan.pages.map((page) => page.templateId)), "Traced plan and production decision page order must match.");
const firstBytes = Buffer.from(first.pdf.output("arraybuffer"));
const secondBytes = Buffer.from(second.pdf.output("arraybuffer"));
assert(firstBytes.equals(secondBytes), "Identical Northbridge inputs must produce byte-identical PDFs.");
const rawPdf = firstBytes.toString("latin1");
assert(rawPdf.includes("Northbridge Advisory") && first.pageOrder[0] === "authored-cover-v1.corporate-clean", "PDF must contain Northbridge identity and the selected Corporate authored cover.");
assert(!/pexels|image credits/i.test(rawPdf), "PDF must not contain legacy Pexels or image-credit markers.");
assert(!containsInternalPresentationCopy(rawPages.flat().join("\n")) && !containsGeneratedFillerCopy(rawPages.flat().join("\n")), "Corporate PDF must not expose planning instructions or generated filler.");
assert(first.pageOrder.length === first.pdf.getNumberOfPages() && first.pageOrder.length === planning.plan.pages.length, "Corporate planned and rendered page counts must match.");
assert(rawPages.slice(1).every((page) => page.join("").trim()), "Corporate PDF must not contain a blank page.");
assert(!/(?:example\.com|info@company|\+1 000)/i.test(rawPages.flat().join("\n")), "Corporate PDF must not invent contact placeholders.");
const outputPath = resolve("artifacts/manual-review/corporate-services-v1-northbridge-live-production-review.pdf");
const requestedOutputPath = resolve("artifacts/manual-review/corporate-services-v1-northbridge-continuation-logo-review.pdf");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, firstBytes);
writeFileSync(requestedOutputPath, firstBytes);

console.log(JSON.stringify({
  generation: { inputIds: selectedSections.map((section) => section.id), outputIds: boundary.sections.map((section) => section.id), diagnostics: boundary.diagnostics, serviceItemIds: boundary.sections.find((section) => section.id === "services")?.items.map((item) => item.id) ?? [] },
  normalization: { inputIds: profile.sections.map((section) => section.id), output: normalized.sections.map((entry) => ({ id: entry.section.id, role: entry.role })), diagnostics: normalized.diagnostics },
  contentUnits: units.map((unit) => ({ id: unit.id, kind: unit.kind, coverage: unit.coverage })),
  ranking,
  plan: planning.plan.pages.map((page) => ({ pageId: page.pageId, templateId: page.templateId, claims: page.claims })),
  coverage,
  preflight: { compatible: prepared.compatible, pageCount: prepared.prepared.instances.length },
  decision: { mode: first.mode, familyId: first.familyId, packId: first.packId, pageOrder: first.pageOrder },
  pdf: { outputPath, bytes: firstBytes.length, sha256: createHash("sha256").update(firstBytes).digest("hex"), byteIdentical: true, corporateMarker: true, legacyMarkers: false },
}, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
