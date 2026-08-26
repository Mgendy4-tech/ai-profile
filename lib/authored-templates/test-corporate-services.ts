import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { jsPDF } from "jspdf";
import { normalizeAuthoredContentUnits, createContentShape } from "./content-shape";
import { createCorporateServicesDocumentPlan } from "./corporate-services-planner";
import { validateDocumentCoverage } from "./coverage";
import { routeEditorialInteriorsV1Export } from "./export-orchestrator";
import { rankAuthoredTemplateFamilies } from "./family-ranking";
import type { ProductionEnrichmentInput } from "./enrichment";
import { authoredTemplateFamilies } from "./registry";
import type { CorporateServicesPageContent } from "./packs/corporate-services-v1/content";
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
for (const count of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
  const input = fixture(count, count === 9 ? "dense" : "normal");
  const decision = await routeEditorialInteriorsV1Export(input);
  assert(decision.mode === "authored" && decision.familyId === "corporate-services", `${count} services must select Corporate / Services: ${JSON.stringify(decision.mode === "fallback" ? decision.reasons : decision)}.`);
  const planned = planFor(input); assert(planned.result.compatible, `${count} services must produce a fixed authored plan.`);
  if (planned.result.compatible) {
    const coverage = validateDocumentCoverage(planned.units, planned.result.plan);
    assert(coverage.complete && coverage.consumedContentIds.length === planned.units.length, `${count} services must be completely consumed exactly once.`);
    assert(planned.result.plan.pages.every((page) => !("geometry" in page) && !("layout" in page) && !("columns" in page)), "Document plans must never contain generated geometry.");
  }
}

for (const templates of [corporateServicesPrimaryTemplates, corporateServicesContinuationTemplates]) for (const [templateIndex, template] of templates.entries()) {
  const count = templateIndex + 1;
  const candidate: CorporateServicesPageContent = { contentId: `geometry:${template.id}`, heading: "Services designed around business clarity", supportingLine: "Fictional test capabilities presented without invented outcomes.", services: Array.from({ length: count }, (_, index) => { const item = service(index, true); return { contentId: `geometry:${template.id}:${index}`, index: String(index + 1).padStart(2, "0"), title: item.name, description: item.description }; }) };
  const prepared = template.prepare(candidate); assert(prepared.compatible, `${template.id} geometry fixture must satisfy its envelope.`); if (!prepared.compatible) continue;
  const pdf = new jsPDF({ unit: "mm", format: "a4" }); const audit = template.render(pdf, prepared.instance);
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

const unsupported = fixture(3, "normal"); unsupported.profile.sections = [...unsupported.profile.sections, { id: "team", title: "Team", description: "", content: "Required unsupported content.", items: [] }];
const unsupportedDecision = await routeEditorialInteriorsV1Export(unsupported);
assert(unsupportedDecision.mode === "fallback" && unsupportedDecision.reasons.some((reason) => reason.code === "unknown_semantic_role"), "Unsupported required content must select atomic fallback.");

const normalFirst = await routeEditorialInteriorsV1Export(fixture(6, "normal")); const normalSecond = await routeEditorialInteriorsV1Export(fixture(6, "normal"));
assert(normalFirst.mode === "authored" && normalSecond.mode === "authored" && Buffer.from(normalFirst.pdf.output("arraybuffer")).equals(Buffer.from(normalSecond.pdf.output("arraybuffer"))), "Corporate PDF output must be byte deterministic.");

for (const [label, input] of [["sparse", fixture(2, "sparse")], ["normal", fixture(6, "normal")], ["dense", fixture(9, "dense")]] as const) {
  const result = await routeEditorialInteriorsV1Export(input); if (result.mode !== "authored") throw new Error(`${label} review fixture was incompatible: ${JSON.stringify(result.reasons)}`);
  const expectedPages = label === "sparse" ? 4 : label === "normal" ? 5 : 6;
  assert(result.pdf.getNumberOfPages() === expectedPages, `${label} must use the expected fixed page sequence.`);
  for (let page = 1; page <= expectedPages; page += 1) { result.pdf.setPage(page); assert(Math.abs(result.pdf.internal.pageSize.getWidth() - 210) < 0.01 && Math.abs(result.pdf.internal.pageSize.getHeight() - 297) < 0.01, `${label} page ${page} must be exact A4.`); }
  const output = resolve("artifacts", "manual-review", `corporate-services-v1-${label}-review.pdf`); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, Buffer.from(result.pdf.output("arraybuffer")));
}

console.log("Corporate / Services planning, cross-family routing, coverage, and review tests passed.");
};

run().catch((error) => { console.error(error); process.exitCode = 1; });
