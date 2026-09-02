import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { jsPDF } from "jspdf";
import { normalizeAuthoredContentUnits, createContentShape } from "./content-shape";
import { createCorporateServicesDocumentPlan, prepareCorporateServicesDocumentPlan, renderPreparedCorporateServicesPlan } from "./corporate-services-planner";
import { validateDocumentCoverage } from "./coverage";
import { routeEditorialInteriorsV1Export } from "./export-orchestrator";
import { rankAuthoredTemplateFamilies } from "./family-ranking";
import type { ProductionEnrichmentInput } from "./enrichment";
import { authoredTemplateFamilies } from "./registry";
import { normalizeProductionSectionRoles } from "./section-role-normalization";
import type { CorporateServicesPageContent } from "./packs/corporate-services-v1/content";
import { CORPORATE_SPARSE_NARRATIVE_BODY_REGION, corporateServicesNarrativeDenseTemplate, corporateServicesNarrativeSparseTemplate, corporateServicesNarrativeStandardTemplate } from "./packs/corporate-services-v1/narrative";
import { CORPORATE_SERVICES_TEXT_GEOMETRY, corporateServicesContinuationTemplates, corporateServicesPrimaryTemplates } from "./packs/corporate-services-v1/services";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const service = (index: number, dense = false) => ({ name: `Service Discipline ${String(index + 1).padStart(2, "0")}`, description: dense ? "A clearly fictional test description covering advisory, delivery coordination, operating alignment, and practical implementation support." : "Clearly fictional test service description." });
const narrativeSentence = "This clearly fictional test company helps business teams clarify complex operating questions and coordinate practical service delivery. ";

const fixture = (serviceCount: number, density: "sparse" | "normal" | "dense"): ProductionEnrichmentInput => ({
  company: { name: density === "dense" ? "Northbridge Strategic Operations Advisory" : density === "sparse" ? "Morrow Co." : "Meridian Business Advisory", about: "Fictional test company.", activities: "Fictional advisory activities.", experience: "Fictional test experience." },
  profile: { companyName: "Test company", companyType: density === "sparse" ? "Business advisory" : "Professional services and operational consulting", sections: [
    { id: "about", title: density === "dense" ? "A coordinated perspective on complex business operations" : "Built for considered business decisions", description: "Fictional test positioning statement for manual review.", content: density === "sparse" ? narrativeSentence : narrativeSentence.repeat(density === "dense" ? 12 : 5), items: [] },
    { id: "services", title: "Services designed around business clarity", description: "Fictional test capabilities presented without invented outcomes or client claims.", content: "Fictional service overview.", items: Array.from({ length: serviceCount }, (_, index) => service(index, density === "dense")) },
  ] },
  projects: [],
});

const planFor = (input: ProductionEnrichmentInput) => {
  const narrative = input.profile.sections[0]; const services = input.profile.sections[1];
  const units = normalizeAuthoredContentUnits({ company: {}, sections: [{ id: narrative.id, role: "narrative", content: narrative.content }, { id: services.id, role: "services", items: services.items.map((_, index) => ({ id: `${services.id}:item:${index}` })) }], projects: [] });
  return { units, result: createCorporateServicesDocumentPlan({ units, cover: { contentId: "company", documentLabel: "COMPANY PROFILE", companyName: input.company.name, companyType: input.profile.companyType }, narrative: { contentId: narrative.id, title: narrative.title, body: narrative.content, supportingLine: narrative.description }, servicesHeading: services.title, servicesSupportingLine: services.description, services: services.items.map((item, index) => ({ contentId: `${services.id}:item:${index}`, index: String(index + 1).padStart(2, "0"), title: item.name, description: item.description })) }) };
};

const run = async () => {
const sparseCandidate = { contentId: "sparse:normal", title: "Built for considered business decisions", supportingLine: "Fictional test positioning statement for manual review.", body: narrativeSentence };
const sparsePrepared = corporateServicesNarrativeSparseTemplate.prepare(sparseCandidate);
assert(sparsePrepared.compatible, "Normal sparse narrative body must pass preflight.");
if (!sparsePrepared.compatible) throw new Error("Expected normal sparse narrative preparation.");
const sparseBody = sparsePrepared.instance.preparedSlots.body;
assert(sparseBody.kind === "text", "Sparse body must prepare as text.");
if (sparseBody.kind !== "text") throw new Error("Expected sparse prepared body text.");
const sparsePdf = new jsPDF({ unit: "mm", format: "a4" });
const sparseAudit = corporateServicesNarrativeSparseTemplate.render(sparsePdf, sparsePrepared.instance);
sparsePdf.setFont("helvetica", "normal"); sparsePdf.setFontSize(CORPORATE_SPARSE_NARRATIVE_BODY_REGION.fontSize);
assert(sparseBody.lines.every((line) => sparsePdf.getTextWidth(line) <= CORPORATE_SPARSE_NARRATIVE_BODY_REGION.width), "Normal sparse body lines must remain inside the authored horizontal bound.");
assert(sparseBody.lines.length <= CORPORATE_SPARSE_NARRATIVE_BODY_REGION.maxLines, "Normal sparse body must remain inside the authored vertical capacity.");
assert(sparseAudit.renderedTextBySlot.body === sparseBody.lines, "Sparse renderer must consume the exact prepared body line array.");

let longestAcceptedBody = "capacity";
let oneOverCapacityBody = "";
for (let count = 2; count < 500; count += 1) {
  const candidateBody = Array.from({ length: count }, () => "capacity").join(" ");
  const result = corporateServicesNarrativeSparseTemplate.prepare({ ...sparseCandidate, contentId: `sparse:capacity:${count}`, body: candidateBody });
  if (result.compatible) longestAcceptedBody = candidateBody;
  else { oneOverCapacityBody = candidateBody; break; }
}
const longestAccepted = corporateServicesNarrativeSparseTemplate.prepare({ ...sparseCandidate, contentId: "sparse:longest", body: longestAcceptedBody });
assert(longestAccepted.compatible, "Longest accepted sparse body must pass preflight.");
if (!longestAccepted.compatible) throw new Error("Expected longest accepted sparse body.");
const longestSlot = longestAccepted.instance.preparedSlots.body;
assert(longestSlot.kind === "text" && longestSlot.lines.length === CORPORATE_SPARSE_NARRATIVE_BODY_REGION.maxLines, "Longest accepted sparse body must occupy exactly the authored ten-line capacity.");
if (longestSlot.kind !== "text") throw new Error("Expected longest sparse body text.");
assert(longestSlot.lines.every((line) => { sparsePdf.setFont("helvetica", "normal"); sparsePdf.setFontSize(CORPORATE_SPARSE_NARRATIVE_BODY_REGION.fontSize); return sparsePdf.getTextWidth(line) <= CORPORATE_SPARSE_NARRATIVE_BODY_REGION.width; }), "Longest accepted sparse body must remain horizontally contained.");
const overSparse = corporateServicesNarrativeSparseTemplate.prepare({ ...sparseCandidate, contentId: "sparse:over", body: oneOverCapacityBody });
const overSparseRepeat = corporateServicesNarrativeSparseTemplate.prepare({ ...sparseCandidate, contentId: "sparse:over", body: oneOverCapacityBody });
assert(!overSparse.compatible && !overSparseRepeat.compatible && JSON.stringify(overSparse.issues) === JSON.stringify(overSparseRepeat.issues), "One-over-capacity sparse body must fail preflight deterministically.");
if (!overSparse.compatible) assert(overSparse.issues.some((issue) => issue.code === "text_line_limit_exceeded" && issue.path === "body"), "Sparse capacity rejection must identify the body line limit.");

const standardBefore = corporateServicesNarrativeStandardTemplate.prepare({ ...sparseCandidate, contentId: "standard:unchanged", body: narrativeSentence.repeat(5) });
const denseBefore = corporateServicesNarrativeDenseTemplate.prepare({ ...sparseCandidate, contentId: "dense:unchanged", body: narrativeSentence.repeat(12) });
assert(standardBefore.compatible && denseBefore.compatible, "Existing normal and dense Corporate narrative variants must retain their approved envelopes.");
for (const count of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
  const input = fixture(count, count >= 9 ? "dense" : "normal");
  const decision = await routeEditorialInteriorsV1Export(input);
  assert(decision.mode === "authored" && decision.familyId === "corporate-services", `${count} services must select Corporate / Services: ${JSON.stringify(decision.mode === "fallback" ? decision.reasons : decision)}.`);
  const planned = planFor(input); assert(planned.result.compatible, `${count} services must produce a fixed authored plan.`);
  if (planned.result.compatible) {
    const coverage = validateDocumentCoverage(planned.units, planned.result.plan);
    assert(coverage.complete && coverage.consumedContentIds.length === planned.units.length, `${count} services must be completely consumed exactly once.`);
    assert(planned.result.plan.pages.every((page) => !("geometry" in page) && !("layout" in page) && !("columns" in page)), "Document plans must never contain generated geometry.");
  }
}

const overCapacity = planFor(fixture(13, "dense"));
assert(!overCapacity.result.compatible && overCapacity.result.issues.some((issue) => issue.code === "service_count_unsupported"), "Thirteen services must fail the bounded authored capacity explicitly.");

const longNarrative = fixture(2, "dense"); longNarrative.profile.sections[0].content = narrativeSentence.repeat(40);
const longNarrativePlan = planFor(longNarrative);
assert(longNarrativePlan.result.compatible, "Long narrative planning must select the dense authored state before preflight.");
if (longNarrativePlan.result.compatible) assert(!prepareCorporateServicesDocumentPlan(longNarrativePlan.result.plan).compatible, "Narrative beyond the dense envelope must reject safely without font shrinking.");

const projectUnits = normalizeAuthoredContentUnits({ company: {}, sections: [{ id: "about", role: "narrative", content: "Narrative." }, { id: "services", role: "services", items: Array.from({ length: 5 }, (_, index) => ({ id: `service:${index}` })) }], projects: [{ id: "work:1", hasAuthenticImage: true }, { id: "work:2", hasAuthenticImage: true }] });
const projectPlan = createCorporateServicesDocumentPlan({ units: projectUnits, cover: { contentId: "company", documentLabel: "COMPANY PROFILE", companyName: "Fictional Company", companyType: "Professional services" }, narrative: { contentId: "about", title: "Company overview", body: "Narrative.", supportingLine: "Fictional test content." }, servicesHeading: "Services", servicesSupportingLine: "Fictional test content.", services: Array.from({ length: 5 }, (_, index) => ({ contentId: `service:${index}`, index: `0${index + 1}`, title: `Service ${index + 1}`, description: "Fictional test service." })), projectsHeading: "Selected work", projectsSupportingLine: "Fictional test work.", projects: [{ contentId: "work:1", name: "Work One", description: "Source-shaped project description." }, { contentId: "work:2", name: "Work Two", description: "Source-shaped project description." }] });
assert(projectPlan.compatible && validateDocumentCoverage(projectUnits, projectPlan.plan).complete, "Corporate optional work must consume genuine project units exactly once.");
if (projectPlan.compatible) {
  const duplicatePlan = structuredClone(projectPlan.plan);
  duplicatePlan.pages[1].claims = [...duplicatePlan.pages[1].claims, { contentId: "work:1", mode: "consume", slotId: "duplicate" }];
  assert(validateDocumentCoverage(projectUnits, duplicatePlan).issues.some((issue) => issue.code === "duplicate_content_consumption"), "Duplicate Corporate work consumption must fail the shared coverage ledger.");
}
assert(rankAuthoredTemplateFamilies(authoredTemplateFamilies, createContentShape(projectUnits))[0]?.familyId === "visual-portfolio", "Authentic project imagery must keep strongly portfolio-shaped content ranked to Visual / Portfolio.");
const missingImageUnits = projectUnits.map((unit) => unit.kind === "project" ? { ...unit, hasAuthenticImage: false } : unit);
assert(rankAuthoredTemplateFamilies(authoredTemplateFamilies, createContentShape(missingImageUnits))[0]?.familyId === "corporate-services", "Missing project imagery must leave a service-led company eligible for Corporate / Services without promoting contextual media.");

for (const templates of [corporateServicesPrimaryTemplates, corporateServicesContinuationTemplates]) for (const [templateIndex, template] of templates.entries()) {
  const count = templateIndex + 1;
  const candidate: CorporateServicesPageContent = { contentId: `geometry:${template.id}`, heading: "Services designed around business clarity", supportingLine: "Fictional test capabilities presented without invented outcomes.", services: Array.from({ length: count }, (_, index) => { const item = service(index, true); return { contentId: `geometry:${template.id}:${index}`, index: String(index + 1).padStart(2, "0"), title: item.name, description: item.description }; }) };
  const prepared = template.prepare(candidate); assert(prepared.compatible, `${template.id} geometry fixture must satisfy its envelope.`); if (!prepared.compatible) continue;
  if (template.pageRole === "continuation") assert(!prepared.instance.preparedSlots.heading && !prepared.instance.preparedSlots.supportingLine, `${template.id} must not prepare the primary services introduction.`);
  const pdf = new jsPDF({ unit: "mm", format: "a4" }); const audit = template.render(pdf, prepared.instance);
  if (template.pageRole === "continuation") assert(!audit.renderedTextBySlot.heading && !audit.renderedTextBySlot.supportingLine, `${template.id} must not repeat the services title or description.`);
  const rowHeight = (CORPORATE_SERVICES_TEXT_GEOMETRY.bottom - CORPORATE_SERVICES_TEXT_GEOMETRY.top) / count;
  for (let index = 0; index < count; index += 1) {
    const titleLines = audit.renderedTextBySlot[`service${index}Title`]; const descriptionLines = audit.renderedTextBySlot[`service${index}Description`];
    pdf.setFont("times", "bold"); pdf.setFontSize(17); const titleRight = CORPORATE_SERVICES_TEXT_GEOMETRY.titleX + Math.max(...titleLines.map((line) => pdf.getTextWidth(line)));
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); const descriptionRight = CORPORATE_SERVICES_TEXT_GEOMETRY.descriptionX + Math.max(...descriptionLines.map((line) => pdf.getTextWidth(line)));
    assert(titleRight <= CORPORATE_SERVICES_TEXT_GEOMETRY.titleX + CORPORATE_SERVICES_TEXT_GEOMETRY.titleWidth && titleRight < CORPORATE_SERVICES_TEXT_GEOMETRY.descriptionX, `${template.id} service ${index} actual title bounds must end before the description column.`);
    assert(descriptionRight <= CORPORATE_SERVICES_TEXT_GEOMETRY.descriptionX + CORPORATE_SERVICES_TEXT_GEOMETRY.descriptionWidth, `${template.id} service ${index} actual description bounds must remain inside its column.`);
    const titleBottom = CORPORATE_SERVICES_TEXT_GEOMETRY.titleYOffset + (titleLines.length - 1) * 17 * 0.352778 + 6;
    const descriptionBottom = CORPORATE_SERVICES_TEXT_GEOMETRY.descriptionYOffset + (descriptionLines.length - 1) * 8.5 * 1.3 * 0.352778 + 3.5;
    assert(titleBottom < rowHeight && descriptionBottom < rowHeight, `${template.id} service ${index} actual text bounds must remain inside its authored row.`);
  }
}

const serviceShape = createContentShape(planFor(fixture(6, "normal")).units);
const serviceRanking = rankAuthoredTemplateFamilies(authoredTemplateFamilies, serviceShape);
assert(serviceRanking[0]?.familyId === "corporate-services", "Service-heavy project-free content must rank Corporate / Services first.");
assert(JSON.stringify(serviceRanking) === JSON.stringify(rankAuthoredTemplateFamilies([...authoredTemplateFamilies].reverse(), serviceShape)), "Cross-family ranking must be independent of registry order.");

const portfolioUnits = normalizeAuthoredContentUnits({ company: {}, sections: [{ id: "about", role: "narrative", content: "Portfolio narrative." }, { id: "services", role: "services", items: [0, 1, 2, 3].map((index) => ({ id: `service:${index}` })) }], projects: [{ id: "project:1", hasAuthenticImage: true }, { id: "project:2", hasAuthenticImage: true }] });
assert(rankAuthoredTemplateFamilies(authoredTemplateFamilies, createContentShape(portfolioUnits))[0]?.familyId === "visual-portfolio", "Portfolio-heavy content with authentic coverage must keep Visual / Portfolio first.");

const northbridgeSections = [
  { id: "about", title: "About Northbridge Advisory", description: "A source-grounded company introduction.", content: "Northbridge Advisory is a fictional production-shaped consulting fixture used to verify exact semantic coverage.", items: [] },
  { id: "services", title: "Consulting & Advisory Services", description: "Source-shaped service information.", content: "The fixture supplies structured advisory services without invented outcomes.", items: Array.from({ length: 4 }, (_, index) => ({ name: `Advisory Service ${index + 1}`, description: "Clearly labelled fictional test service content." })) },
  { id: "expertise", title: "Areas of Focus", description: "Source-shaped expertise context.", content: "The fictional fixture focuses on operations, priorities, management processes, and sustainable growth.", items: [] },
  { id: "howItWorks", title: "Our Advisory Approach", description: "Source-shaped process context.", content: "The fictional fixture works with leadership teams to identify challenges and structure practical responses.", items: [] },
  { id: "solutions", title: "Supporting Sustainable Growth", description: "Source-shaped supporting context.", content: "The fictional fixture describes practical operational foundations without claiming measured outcomes.", items: [] },
] as const;
const northbridgeNormalized = normalizeProductionSectionRoles(northbridgeSections, { corporateServices: true });
assert(northbridgeNormalized.diagnostics.length === 0, "Exact Northbridge sections must normalize without unknown, ambiguous, or duplicate-role diagnostics.");
assert(northbridgeNormalized.sections.map((entry) => `${entry.section.id}:${entry.role}`).join("|") === "about:narrative|services:services|expertise:expertise|howItWorks:approach|solutions:supporting_narrative", "Northbridge semantic roles must remain exact and deterministic.");
const northbridgeUnits = normalizeAuthoredContentUnits({ company: {}, sections: [
  { id: "about", role: "narrative", content: northbridgeSections[0].content },
  { id: "services", role: "services", items: northbridgeSections[1].items.map((_, index) => ({ id: `services:item:${index}` })) },
  { id: "expertise", role: "expertise", content: northbridgeSections[2].content },
  { id: "howItWorks", role: "approach", content: northbridgeSections[3].content },
  { id: "solutions", role: "supporting_narrative", content: northbridgeSections[4].content },
], projects: [] });
const northbridgeShape = createContentShape(northbridgeUnits);
const northbridgeRanking = rankAuthoredTemplateFamilies(authoredTemplateFamilies, northbridgeShape);
assert(northbridgeRanking[0]?.familyId === "corporate-services" && northbridgeShape.facts.authenticProjectImageCount === 0, "Northbridge must rank Corporate first without treating contextual imagery as authentic project coverage.");
const northbridgePlan = createCorporateServicesDocumentPlan({
  units: northbridgeUnits,
  cover: { contentId: "company", documentLabel: "COMPANY PROFILE", companyName: "Northbridge Advisory", companyType: "Business Consulting and Advisory Firm" },
  narrative: { contentId: "about", title: northbridgeSections[0].title, body: northbridgeSections[0].content, supportingLine: northbridgeSections[0].description },
  servicesHeading: northbridgeSections[1].title,
  servicesSupportingLine: northbridgeSections[1].description,
  services: northbridgeSections[1].items.map((item, index) => ({ contentId: `services:item:${index}`, index: String(index + 1).padStart(2, "0"), title: item.name, description: item.description })),
  details: northbridgeSections.slice(2).map((section) => ({ contentId: section.id, title: section.title, body: section.content, supportingLine: section.description })),
});
assert(northbridgePlan.compatible, "Northbridge must create a Corporate authored plan.");
if (!northbridgePlan.compatible) throw new Error("Expected Northbridge Corporate plan.");
const northbridgeCoverage = validateDocumentCoverage(northbridgeUnits, northbridgePlan.plan);
assert(northbridgeCoverage.complete && northbridgeCoverage.consumedContentIds.length === northbridgeUnits.length && new Set(northbridgeCoverage.consumedContentIds).size === northbridgeUnits.length, "Every Northbridge normalized unit must be consumed exactly once without silent section loss.");
const ambiguousCorporate = normalizeProductionSectionRoles([{ ...northbridgeSections[0], id: "about-services" }]);
assert(ambiguousCorporate.diagnostics[0]?.code === "ambiguous_semantic_role", "Unsupported ambiguous Corporate IDs must still fail explicitly.");

const northbridgeInput: ProductionEnrichmentInput = { company: { name: "Northbridge Advisory", about: northbridgeSections[0].content, activities: "Business Consulting & Advisory Services", experience: "Fictional test source field." }, profile: { companyName: "Northbridge Advisory", companyType: "Business Consulting and Advisory Firm", sections: northbridgeSections }, projects: [] };
const northbridgeDecision = await routeEditorialInteriorsV1Export(northbridgeInput);
assert(northbridgeDecision.mode === "authored" && northbridgeDecision.familyId === "corporate-services" && northbridgeDecision.packId === "corporate-services-v1", "Production-shaped Northbridge must render through Corporate authored orchestration, not legacy fallback.");
if (northbridgeDecision.mode !== "authored") throw new Error(`Northbridge authored orchestration failed: ${JSON.stringify(northbridgeDecision.reasons)}`);
assert(northbridgeDecision.pageOrder.slice(-4, -1).join("|") === "corporate-services-v1.narrative-sparse|corporate-services-v1.narrative-sparse|corporate-services-v1.narrative-sparse" && northbridgeDecision.pageOrder.at(-1) === "corporate-services-v1.closing", "Northbridge detail sections must use fixed Corporate narrative variants before closing.");
const northbridgeOutput = resolve("artifacts", "manual-review", "corporate-services-v1-northbridge-production-review.pdf");
mkdirSync(dirname(northbridgeOutput), { recursive: true }); writeFileSync(northbridgeOutput, Buffer.from(northbridgeDecision.pdf.output("arraybuffer")));

const unsupported = fixture(3, "normal"); unsupported.profile.sections = [...unsupported.profile.sections, { id: "team", title: "Team", description: "", content: "Required unsupported content.", items: [] }];
const unsupportedDecision = await routeEditorialInteriorsV1Export(unsupported);
assert(unsupportedDecision.mode === "fallback" && unsupportedDecision.reasons.some((reason) => reason.code === "unknown_semantic_role"), "Unsupported required content must select atomic fallback.");

const normalFirst = await routeEditorialInteriorsV1Export(fixture(6, "normal")); const normalSecond = await routeEditorialInteriorsV1Export(fixture(6, "normal"));
assert(normalFirst.mode === "authored" && normalSecond.mode === "authored" && Buffer.from(normalFirst.pdf.output("arraybuffer")).equals(Buffer.from(normalSecond.pdf.output("arraybuffer"))), "Corporate PDF output must be byte deterministic.");

for (const [label, input] of [["sparse", fixture(2, "sparse")], ["normal", fixture(6, "normal")], ["dense", fixture(9, "dense")]] as const) {
  const result = await routeEditorialInteriorsV1Export(input); if (result.mode !== "authored") throw new Error(`${label} review fixture was incompatible: ${JSON.stringify(result.reasons)}`);
  const expectedPages = label === "sparse" ? 5 : label === "normal" ? 6 : 7;
  assert(result.pdf.getNumberOfPages() === expectedPages, `${label} must use the expected fixed page sequence.`);
  for (let page = 1; page <= expectedPages; page += 1) { result.pdf.setPage(page); assert(Math.abs(result.pdf.internal.pageSize.getWidth() - 210) < 0.01 && Math.abs(result.pdf.internal.pageSize.getHeight() - 297) < 0.01, `${label} page ${page} must be exact A4.`); }
  const output = resolve("artifacts", "manual-review", `corporate-services-v1-${label}-review.pdf`); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, Buffer.from(result.pdf.output("arraybuffer")));
}

console.log("Corporate / Services planning, cross-family routing, coverage, and review tests passed.");
};

run().catch((error) => { console.error(error); process.exitCode = 1; });
