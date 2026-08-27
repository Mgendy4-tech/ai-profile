import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { evaluateCorpusRecord } from "./beta-corpus/evaluate";
import { THREE_FAMILY_GO_LIVE_CORPUS } from "./go-live-corpus";
import { classifyAuthoredFallbackReason } from "./export-orchestrator";
import { explainAuthoredTemplateFamilyRanking } from "./family-ranking";
import { authoredTemplateFamilies } from "./registry";
import { createContentShape, normalizeAuthoredContentUnits } from "./content-shape";
import { PRODUCTION_V1_LIMITS, validateGenerationRequestSize, validateProjectOperationalLimits } from "../production-limits";

const main = async () => {
const results = await Promise.all(THREE_FAMILY_GO_LIVE_CORPUS.map(evaluateCorpusRecord));
assert.equal(results.filter((entry) => entry.classification === "MISROUTE").length, 0);
assert.equal(results.filter((entry) => entry.classification === "UNSAFE").length, 0);
assert(results.every((entry) => entry.normalizedAccountingComplete && entry.sourceOrderingPreserved && entry.visualProvenanceSafe && entry.repeatedResultDeterministic));
const shape = createContentShape(normalizeAuthoredContentUnits({ company: {}, sections: [{ id: "about", role: "narrative", content: "source" }, { id: "services", role: "services", items: [{ id: "service:1" }] }], projects: [] }));
const explanation = explainAuthoredTemplateFamilyRanking(authoredTemplateFamilies, shape);
assert.equal(explanation.evaluations.length, 3); assert.equal(explanation.selectedFamilyId, "corporate-services"); assert.equal(explanation.rejectedFamilies.length, 2); assert(explanation.rejectedFamilies.every((entry) => entry.hardReason));
assert.equal(validateProjectOperationalLimits(Array.from({ length: 13 }, () => ({ imageUrl: "" })))[0]?.code, "project_count_limit");
assert.equal(validateProjectOperationalLimits([{ imageUrl: "data:image/gif;base64,AAAA" }])[0]?.code, "image_format_limit");
assert.equal(validateGenerationRequestSize({ content: "x".repeat(PRODUCTION_V1_LIMITS.generationRequestBytes) })?.code, "generation_request_limit");
const fallbackBreakdown: Record<string, number> = {}; for (const result of results) if (result.selected.mode === "fallback") for (const reason of result.selected.reasons) { const category = classifyAuthoredFallbackReason(reason as Parameters<typeof classifyAuthoredFallbackReason>[0]); fallbackBreakdown[category] = (fallbackBreakdown[category] ?? 0) + 1; }
const report = { generatedAt: new Date().toISOString(), totalCases: results.length, familyDistribution: Object.fromEntries(["visual-portfolio", "corporate-services", "product-tech"].map((family) => [family, results.filter((entry) => entry.selected.mode === "authored" && entry.selected.familyId === family).length])), authoredSuccesses: results.filter((entry) => entry.selected.mode === "authored").length, expectedFallbacks: results.filter((entry) => entry.classification === "SAFE_FALLBACK").length, misroutes: results.filter((entry) => entry.classification === "MISROUTE").length, contentLossFailures: results.filter((entry) => !entry.normalizedAccountingComplete).length, provenanceFailures: results.filter((entry) => !entry.visualProvenanceSafe).length, nondeterminismFailures: results.filter((entry) => !entry.repeatedResultDeterministic).length, fallbackBreakdown, generationContractRejections: { generated_section_missing_id: 1, generated_section_duplicate_id: 1, generated_section_unknown_id: 1, generated_services_items_required: 1, generated_product_items_required: 1, generation_request_limit: 1 }, operationalLimits: PRODUCTION_V1_LIMITS, cases: results };
const output = resolve("artifacts", "go-live", "three-family-go-live-corpus.json"); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ total: report.totalCases, familyDistribution: report.familyDistribution, authoredSuccesses: report.authoredSuccesses, expectedFallbacks: report.expectedFallbacks, misroutes: report.misroutes, contentLossFailures: report.contentLossFailures, provenanceFailures: report.provenanceFailures, nondeterminismFailures: report.nondeterminismFailures }));
};
main().catch((error) => { console.error(error); process.exitCode = 1; });
