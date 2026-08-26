import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { jsPDF } from "jspdf";
import { createContentShape, normalizeAuthoredContentUnits } from "./content-shape";
import { validateDocumentCoverage } from "./coverage";
import type { ProductionEnrichmentInput } from "./enrichment";
import { routeEditorialInteriorsV1Export } from "./export-orchestrator";
import { rankAuthoredTemplateFamilies } from "./family-ranking";
import { createProductTechDocumentPlan } from "./product-tech-planner";
import { authoredTemplateFamilies } from "./registry";
import { productTechOverviewTemplate } from "./packs/product-tech-v1/overview";
import type { ProductFeaturesPageContent } from "./packs/product-tech-v1/content";
import { PRODUCT_FEATURE_CONTINUATION_GEOMETRY, productFeatureContinuationTemplates } from "./packs/product-tech-v1/features";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const sentence = "This clearly fictional product description explains source-backed platform positioning without invented performance or adoption claims. ";
const feature = (index: number, dense = false) => ({ name: `Product capability ${String(index + 1).padStart(2, "0")}`, description: dense ? "Clearly fictional test copy describing configuration, workflow coordination, structured review, and controlled operational visibility." : "Clearly fictional product capability description." });
const useCase = (index: number) => ({ name: `Application context ${String(index + 1).padStart(2, "0")}`, description: "Clearly fictional test application based only on supplied fixture content." });

const fixture = (featureCount: number, density: "sparse" | "normal" | "dense", useCaseCount = 0): ProductionEnrichmentInput => ({
  company: { name: density === "dense" ? "Vectorline Intelligence Operations Platform" : density === "sparse" ? "Nodi" : "Relayform Systems", about: "Fictional product company.", activities: "", experience: "" },
  profile: { companyName: "Test product", companyType: density === "sparse" ? "SaaS platform" : "AI software platform", sections: [
    { id: "about", title: density === "dense" ? "A shared operating layer for complex product workflows" : "One product system, clearly organized", description: "Fictional positioning supplied for authored-template review.", content: sentence.repeat(density === "sparse" ? 2 : density === "dense" ? 10 : 5), items: [] },
    { id: "features", title: "A modular product capability set", description: "Fictional feature content with no inferred integrations, metrics, or outcomes.", content: "Fictional feature overview.", items: Array.from({ length: featureCount }, (_, index) => feature(index, density === "dense")) },
    ...(useCaseCount ? [{ id: "useCases", title: "Applications across operating contexts", description: "Fictional use cases supplied explicitly by the review fixture.", content: "Fictional application overview.", items: Array.from({ length: useCaseCount }, (_, index) => useCase(index)) }] : []),
  ] }, projects: [],
});

const planFor = (input: ProductionEnrichmentInput) => {
  const overview = input.profile.sections[0]; const features = input.profile.sections[1]; const useCases = input.profile.sections[2];
  const units = normalizeAuthoredContentUnits({ company: {}, sections: [{ id: overview.id, role: "narrative", content: overview.content }, { id: features.id, role: "features", items: features.items.map((_, index) => ({ id: `${features.id}:item:${index}` })) }, ...(useCases ? [{ id: useCases.id, role: "use_cases" as const, items: useCases.items.map((_, index) => ({ id: `${useCases.id}:item:${index}` })) }] : [])], projects: [] });
  const result = createProductTechDocumentPlan({ units, cover: { contentId: "company", documentLabel: "PRODUCT PROFILE", companyName: input.company.name, companyType: input.profile.companyType }, overview: { contentId: overview.id, title: overview.title, body: overview.content, supportingLine: overview.description }, featuresHeading: features.title, featuresSupportingLine: features.description, features: features.items.map((item, index) => ({ contentId: `${features.id}:item:${index}`, index: String(index + 1).padStart(2, "0"), title: item.name, description: item.description })), ...(useCases ? { useCases: { heading: useCases.title, supportingLine: useCases.description, items: useCases.items.map((item, index) => ({ contentId: `${useCases.id}:item:${index}`, index: String(index + 1).padStart(2, "0"), title: item.name, description: item.description })) } } : {}) });
  return { units, result };
};

const run = async () => {
  const assertSupportingWordsRemainWhole = (source: string) => {
    const prepared = productTechOverviewTemplate.prepare({ contentId: "overview:wrap-test", title: "Product overview", body: "Source-backed product narrative.", supportingLine: source });
    assert(prepared.compatible, `Supporting copy must fit without word splitting: ${source}`); if (!prepared.compatible) return;
    const slot = prepared.instance.preparedSlots.supportingLine; assert(slot?.kind === "text", "Supporting text must be prepared."); if (!slot || slot.kind !== "text") return;
    const tokens = new Set(slot.lines.flatMap((line) => line.trim().split(/\s+/).filter(Boolean))); assert(source.trim().split(/\s+/).every((word) => tokens.has(word)), "Prepared supporting lines must preserve every ordinary source word intact.");
  };
  for (const density of ["sparse", "normal", "dense"] as const) assertSupportingWordsRemainWhole(fixture(2, density).profile.sections[0].description);
  const maximumSupportingCopy = "authored-template review authored-template review authored-template review authored-template";
  const maximumPrepared = productTechOverviewTemplate.prepare({ contentId: "overview:max-wrap", title: "Product overview", body: "Source-backed product narrative.", supportingLine: maximumSupportingCopy });
  assert(maximumPrepared.compatible, "Maximum supported rail fixture must be accepted."); if (maximumPrepared.compatible) { const slot = maximumPrepared.instance.preparedSlots.supportingLine; assert(slot?.kind === "text" && slot.lines.length === 7, "Maximum supported rail fixture must occupy exactly seven whole-word lines."); }
  assertSupportingWordsRemainWhole(maximumSupportingCopy);
  const overwideWord = productTechOverviewTemplate.prepare({ contentId: "overview:wide-word", title: "Product overview", body: "Source-backed product narrative.", supportingLine: "ordinary extraordinarilylongunbrokenword" });
  assert(!overwideWord.compatible && overwideWord.issues.some((issue) => issue.code === "text_word_width_exceeded" && issue.path === "supportingLine"), "An overwide word must be rejected explicitly instead of split.");
  for (const [templateIndex, template] of productFeatureContinuationTemplates.entries()) {
    const count = (templateIndex + 1) as 1 | 2 | 3 | 4; const geometry = PRODUCT_FEATURE_CONTINUATION_GEOMETRY[count];
    const candidate: ProductFeaturesPageContent = { contentId: `continuation:${count}`, heading: "A modular product capability set", supportingLine: "Fictional source-backed feature content for fixed-geometry testing.", features: Array.from({ length: count }, (_, index) => { const item = feature(index, true); return { contentId: `feature:${index}`, index: String(index + 1).padStart(2, "0"), title: item.name, description: item.description }; }) };
    const prepared = template.prepare(candidate); assert(prepared.compatible, `${template.id} must accept its exact-count boundary fixture.`); if (!prepared.compatible) continue;
    const pdf = new jsPDF({ unit: "mm", format: "a4" }); const audit = template.render(pdf, prepared.instance);
    assert(geometry.cells.length === count && geometry.horizontalRules.every((y) => y >= 0 && y <= 297) && geometry.verticalRules.every((rule) => rule.x >= 0 && rule.x <= 210 && rule.y1 >= 0 && rule.y2 <= 297), `${template.id} authored geometry must remain inside A4.`);
    geometry.cells.forEach((cell, index) => {
      const titleLines = audit.renderedTextBySlot[`feature${index}Title`]; const descriptionLines = audit.renderedTextBySlot[`feature${index}Description`];
      pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); const titleRight = cell.x + Math.max(...titleLines.map((line) => pdf.getTextWidth(line))); const titleBottom = cell.y + 14 + (titleLines.length - 1) * 14 * 0.352778 + 5;
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.25); const descriptionRight = cell.x + Math.max(...descriptionLines.map((line) => pdf.getTextWidth(line))); const descriptionTop = cell.y + 31; const descriptionBottom = cell.y + 34 + (descriptionLines.length - 1) * 8.25 * 1.3 * 0.352778 + 3.5;
      assert(cell.x >= 0 && cell.x + 70 <= 210 && cell.y >= 0 && cell.bottom <= 297, `${template.id} feature ${index} region must remain inside A4.`);
      assert(titleRight <= cell.x + 70 && descriptionRight <= cell.x + 70, `${template.id} feature ${index} text must remain inside its authored width.`);
      assert(titleBottom < descriptionTop && descriptionBottom < cell.bottom, `${template.id} feature ${index} title and description must not collide or escape their region.`);
    });
  }
  for (const remaining of [1, 2, 3, 4] as const) {
    const input = fixture(4 + remaining, "normal"); const planned = planFor(input); assert(planned.result.compatible, `${remaining}-item continuation plan must be compatible.`); if (!planned.result.compatible) continue;
    const terminal = planned.result.plan.pages.at(-1)!; assert(terminal.templateId === `product-tech-v1.features-continuation-${remaining}`, `Exactly ${remaining} remaining features must select the fixed ${remaining}-item continuation.`);
    assert(terminal.claims.map((claim) => claim.contentId).join("|") === Array.from({ length: remaining }, (_, index) => `features:item:${index + 4}`).join("|"), `${remaining}-item continuation must consume every terminal feature once in source order.`);
    const firstOutput = await routeEditorialInteriorsV1Export(input); const secondOutput = await routeEditorialInteriorsV1Export(input); assert(firstOutput.mode === "authored" && secondOutput.mode === "authored" && Buffer.from(firstOutput.pdf.output("arraybuffer")).equals(Buffer.from(secondOutput.pdf.output("arraybuffer"))), `${remaining}-item continuation output must be deterministic.`);
  }
  for (const count of [1, 2, 3, 4, 5, 6, 7, 8, 10]) {
    const input = fixture(count, count === 10 ? "dense" : "normal", count === 6 ? 4 : 0); const decision = await routeEditorialInteriorsV1Export(input);
    assert(decision.mode === "authored" && decision.familyId === "product-tech", `${count} product features must select Product / Tech: ${JSON.stringify(decision.mode === "fallback" ? decision.reasons : decision)}.`);
    const planned = planFor(input); assert(planned.result.compatible, `${count} features must create a fixed plan.`); if (planned.result.compatible) { const coverage = validateDocumentCoverage(planned.units, planned.result.plan); assert(coverage.complete && coverage.consumedContentIds.length === planned.units.length, `${count} features and optional use cases must be consumed exactly once.`); assert(planned.result.plan.pages.every((page) => !("geometry" in page) && !("layout" in page) && !("columns" in page)), "Product plans must not contain geometry."); }
  }

  const productPlan = planFor(fixture(6, "normal", 3)); const productRanking = rankAuthoredTemplateFamilies(authoredTemplateFamilies, createContentShape(productPlan.units, null, true));
  assert(productRanking[0]?.familyId === "product-tech", "Product-led shape must rank Product / Tech first.");
  assert(JSON.stringify(productRanking) === JSON.stringify(rankAuthoredTemplateFamilies([...authoredTemplateFamilies].reverse(), createContentShape(productPlan.units, null, true))), "Ranking must be independent of registry order.");
  const corporateUnits = normalizeAuthoredContentUnits({ company: {}, sections: [{ id: "about", role: "narrative", content: "Consulting narrative." }, { id: "services", role: "services", items: [1, 2, 3].map((id) => ({ id: `service:${id}` })) }], projects: [] });
  assert(rankAuthoredTemplateFamilies(authoredTemplateFamilies, createContentShape(corporateUnits))[0]?.familyId === "corporate-services", "Consulting shape must keep Corporate first.");
  const portfolioUnits = normalizeAuthoredContentUnits({ company: {}, sections: [{ id: "about", role: "narrative", content: "Portfolio narrative." }, { id: "services", role: "services", items: [1, 2, 3, 4].map((id) => ({ id: `service:${id}` })) }], projects: [{ id: "project:1", hasAuthenticImage: true }] });
  assert(rankAuthoredTemplateFamilies(authoredTemplateFamilies, createContentShape(portfolioUnits))[0]?.familyId === "visual-portfolio", "Authentic portfolio shape must keep Visual first.");

  const unsupported = fixture(3, "normal"); unsupported.profile.sections = [...unsupported.profile.sections, { id: "team", title: "Team", description: "", content: "Required unsupported content.", items: [] }]; const unsupportedDecision = await routeEditorialInteriorsV1Export(unsupported); assert(unsupportedDecision.mode === "fallback", "Unsupported required sections must fall back atomically.");
  const first = await routeEditorialInteriorsV1Export(fixture(6, "normal", 3)); const second = await routeEditorialInteriorsV1Export(fixture(6, "normal", 3)); assert(first.mode === "authored" && second.mode === "authored" && Buffer.from(first.pdf.output("arraybuffer")).equals(Buffer.from(second.pdf.output("arraybuffer"))), "Product output must be byte deterministic.");

  for (const [label, input] of [["sparse", fixture(2, "sparse")], ["normal", fixture(6, "normal", 3)], ["dense", fixture(10, "dense", 5)]] as const) { const decision = await routeEditorialInteriorsV1Export(input); if (decision.mode !== "authored") throw new Error(`${label} fixture failed: ${JSON.stringify(decision.reasons)}`); const expectedPages = label === "sparse" ? 3 : label === "normal" ? 5 : 7; assert(decision.pdf.getNumberOfPages() === expectedPages, `${label} must use the expected fixed page sequence.`); for (let page = 1; page <= expectedPages; page += 1) { decision.pdf.setPage(page); assert(Math.abs(decision.pdf.internal.pageSize.getWidth() - 210) < 0.01 && Math.abs(decision.pdf.internal.pageSize.getHeight() - 297) < 0.01, `${label} page ${page} must be exact A4.`); } const output = resolve("artifacts", "manual-review", `product-tech-v1-${label}-review.pdf`); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, Buffer.from(decision.pdf.output("arraybuffer"))); }
  console.log("Product / Tech planning, routing, coverage, ranking, and review tests passed.");
};
run().catch((error) => { console.error(error); process.exitCode = 1; });
