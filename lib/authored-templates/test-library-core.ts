import { normalizeAuthoredContentUnits, createContentShape, deriveDeterministicContentFacts } from "./content-shape";
import { validateDocumentCoverage } from "./coverage";
import { validateAuthoredDocumentPlan } from "./document-plan";
import { rankAuthoredTemplateFamilies } from "./family-ranking";
import type { AuthoredDocumentPlan, AuthoredTemplateFamily, NormalizedContentUnit } from "./library-types";
import { authoredTemplateFamilies, authoredTemplatePacks, getAuthoredTemplateFamily, getAuthoredTemplatePack } from "./registry";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

const normalizationInput = {
  company: {},
  sections: [
    { id: "about", role: "narrative" as const, content: "Exact narrative." },
    { id: "services", role: "services" as const, items: [{}, { id: "service:explicit" }] },
  ],
  projects: [
    { id: "project:one", hasAuthenticImage: true },
    { id: "project:two", hasAuthenticImage: false },
  ],
};

const units = normalizeAuthoredContentUnits(normalizationInput);
assert(units.map((unit) => unit.id).join("|") === "company|about|services:item:0|service:explicit|project:one|project:two", "Normalized IDs must preserve explicit IDs and derive missing IDs stably.");
assert(JSON.stringify(units) === JSON.stringify(normalizeAuthoredContentUnits(normalizationInput)), "Normalization must be deterministic.");

const facts = deriveDeterministicContentFacts(units);
assert(JSON.stringify(facts) === JSON.stringify({
  narrativeSectionCount: 1,
  narrativeCharacterCount: "Exact narrative.".length,
  serviceCount: 2,
  productFeatureCount: 0,
  useCaseCount: 0,
  productTechSignal: false,
  projectCount: 2,
  authenticProjectImageCount: 1,
  authenticProjectImageCoverage: 0.5,
  totalContentUnitCount: 6,
}), "Facts must be raw deterministic measurements of normalized units.");
assert(createContentShape(units).semantics === null, "Semantic descriptors must be optional and null by default.");

let evaluatorCalls = 0;
const family = (
  id: string,
  priority: number,
  eligible: boolean,
  contributions: readonly (-3 | -2 | -1 | 0 | 1 | 2 | 3)[],
): AuthoredTemplateFamily => ({
  id,
  label: id,
  priority,
  packs: [],
  evaluate: () => {
    evaluatorCalls += 1;
    return { eligible, reasons: contributions.map((contribution, index) => ({ code: `${id}:${index}`, contribution, evidenceContentIds: [] })) };
  },
});

const families = [family("z-family", 1, true, [2, 1]), family("a-family", 1, true, [3]), family("ineligible", 100, false, [3])];
const shape = createContentShape(units);
const ranking = rankAuthoredTemplateFamilies(families, shape);
assert(evaluatorCalls === 3, "Central ranking must delegate all family-specific behavior to registered evaluators.");
assert(ranking.map((entry) => entry.familyId).join("|") === "a-family|z-family", "Eligibility and stable ID tie-breaking must be deterministic.");
assert(ranking[0].score === 3 && ranking[0].reasons.length === 1, "Scores must be additive reason contributions.");
assert(JSON.stringify(ranking) === JSON.stringify(rankAuthoredTemplateFamilies([...families].reverse(), shape)), "Ranking must be independent of registration iteration order.");
assert(JSON.stringify(ranking) === JSON.stringify(rankAuthoredTemplateFamilies(families, shape)), "Identical ranking input must produce identical output.");

const claims = units.map((unit) => ({ contentId: unit.id, mode: "consume" as const, slotId: `slot:${unit.id}` }));
const plan: AuthoredDocumentPlan = {
  familyId: "visual-portfolio",
  packId: "editorial-interiors-v1",
  pages: [{ pageId: "page:cover", templateId: "editorial-interiors-v1.cover", pageRole: "cover", candidate: {}, claims }],
};
const complete = validateDocumentCoverage(units, plan);
assert(complete.complete && complete.consumedContentIds.length === units.length, "Every required unit consumed exactly once must pass coverage.");
assert(JSON.stringify(complete) === JSON.stringify(validateDocumentCoverage(units, plan)), "Coverage results must be deterministic.");

const unknownPlan = structuredClone(plan);
unknownPlan.pages[0].claims = [...unknownPlan.pages[0].claims, { contentId: "unknown", mode: "consume", slotId: "unknown" }];
assert(validateDocumentCoverage(units, unknownPlan).issues.some((issue) => issue.code === "unknown_content_claim"), "Unknown claimed IDs must be rejected.");

const missingPlan = structuredClone(plan);
missingPlan.pages[0].claims = missingPlan.pages[0].claims.filter((claim) => claim.contentId !== "project:two");
assert(validateDocumentCoverage(units, missingPlan).issues.some((issue) => issue.code === "required_content_not_consumed" && issue.contentId === "project:two"), "Missing required consumption must be rejected.");

const duplicatePlan = structuredClone(plan);
duplicatePlan.pages[0].claims = [...duplicatePlan.pages[0].claims, { contentId: "project:one", mode: "consume", slotId: "duplicate" }];
assert(validateDocumentCoverage(units, duplicatePlan).issues.some((issue) => issue.code === "duplicate_content_consumption"), "Duplicate semantic consumption must be rejected.");

const repeatedReferencePlan = structuredClone(plan);
repeatedReferencePlan.pages[0].claims = [
  ...repeatedReferencePlan.pages[0].claims,
  { contentId: "project:one", mode: "reference", slotId: "coverHero" },
  { contentId: "project:one", mode: "reference", slotId: "featureHero" },
];
const repeatedReference = validateDocumentCoverage(units, repeatedReferencePlan);
assert(repeatedReference.complete && repeatedReference.referencedContentIds.filter((id) => id === "project:one").length === 2, "Repeated references must not duplicate semantic consumption.");

const optionalUnits: readonly NormalizedContentUnit[] = units.map((unit) => unit.id === "project:two" ? { ...unit, coverage: "optional" as const } : unit);
assert(validateDocumentCoverage(optionalUnits, missingPlan).complete, "Omission is allowed only for explicitly optional units.");
assert(!validateDocumentCoverage(units, missingPlan).complete, "The same omission must fail when the unit is required.");

assert(validateAuthoredDocumentPlan(plan, authoredTemplatePacks).length === 0, "Plans using registered pack templates and matching roles must pass structural validation.");
const geometryPlan = { ...plan, layout: { columns: 4 }, pages: [{ ...plan.pages[0], x: 10 }] } as unknown as AuthoredDocumentPlan;
const geometryIssues = validateAuthoredDocumentPlan(geometryPlan, authoredTemplatePacks);
assert(geometryIssues.filter((issue) => issue.code === "layout_parameter_not_allowed").length === 2, "Core plans must reject document- and page-level layout parameters.");
assert(!("x" in plan.pages[0]) && !("geometry" in plan) && !("fontSize" in plan.pages[0]), "The planning contract must expose semantic selection only, never geometry.");

assert(getAuthoredTemplatePack("editorial-interiors-v1") === authoredTemplatePacks[0], "Existing pack registration must remain unchanged.");
assert(getAuthoredTemplateFamily("visual-portfolio") === authoredTemplateFamilies[0], "The proven pack must be wrapped by the registered Visual / Portfolio family.");
assert(authoredTemplateFamilies[0].packs[0].id === "editorial-interiors-v1", "The tested pack ID must remain stable inside the family registry.");

console.log("Authored Template Library Core tests passed.");
