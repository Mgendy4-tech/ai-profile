import { createContentShape, normalizeAuthoredContentUnits, type AuthoredNormalizationInput } from "../content-shape";
import { enrichProductionContentForAuthoredTemplates } from "../enrichment";
import { routeEditorialInteriorsV1Export } from "../export-orchestrator";
import { rankAuthoredTemplateFamilies } from "../family-ranking";
import { authoredTemplateFamilies } from "../registry";
import { isProductTechCompanyType, normalizeProductionSectionRoles } from "../section-role-normalization";
import type { AuthoredCorpusRecord } from "./fixtures";

export type CorpusClassification = "PASS" | "SAFE_FALLBACK" | "MISROUTE" | "UNSAFE";
export type CorpusEvaluation = { corpusId: string; classification: CorpusClassification; productTechClassification: boolean; normalizedSectionRoles: readonly { id: string; role: string }[]; normalizationDiagnostics: readonly { code: string; path: string }[]; normalizedUnitCounts: Readonly<Record<string, number>>; contentShapeFacts: object; familyEvaluations: ReturnType<typeof rankAuthoredTemplateFamilies>; finalRankedOrder: readonly string[]; selected: { mode: "authored"; familyId: string; packId: string; pageCount: number } | { mode: "fallback"; reasons: readonly { stage: string; code: string; path: string; pageRole: string | null }[] }; coverage: "passed" | "not_reached"; preflight: "passed" | "not_reached" | "failed"; registryOrderIndependent: boolean; repeatedResultDeterministic: boolean; normalizedAccountingComplete: boolean; sourceOrderingPreserved: boolean; visualProvenanceSafe: boolean };
const decoder = async () => ({ width: 1054, height: 1492 });
const stableDecision = (decision: Awaited<ReturnType<typeof routeEditorialInteriorsV1Export>>) => decision.mode === "authored" ? { mode: decision.mode, familyId: decision.familyId, packId: decision.packId, pageOrder: decision.pageOrder, pdf: Buffer.from(decision.pdf.output("arraybuffer")).toString("base64") } : decision;

export const evaluateCorpusRecord = async (record: AuthoredCorpusRecord): Promise<CorpusEvaluation> => {
  const productTechClassification = isProductTechCompanyType(record.input.profile.companyType);
  const normalized = normalizeProductionSectionRoles(record.input.profile.sections, { productTech: productTechClassification && record.input.projects.length === 0 });
  const enriched = await enrichProductionContentForAuthoredTemplates(record.input, decoder);
  const sections: AuthoredNormalizationInput["sections"][number][] = [];
  normalized.sections.forEach((entry) => {
    if (entry.role === "narrative") sections.push({ id: entry.section.id, role: "narrative", content: entry.section.content });
    else if (entry.role === "services" || entry.role === "features" || entry.role === "use_cases") sections.push({ id: entry.section.id, role: entry.role, items: entry.section.items.map((_, index) => ({ id: `${entry.section.id}:item:${index}` })) });
  });
  const visualIds = new Set(enriched.adapterInput.projectVisuals.map((visual) => visual.projectId));
  const units = normalizeAuthoredContentUnits({ company: {}, sections, projects: record.input.projects.map((project) => ({ id: project.id, hasAuthenticImage: visualIds.has(project.id) })) });
  const shape = createContentShape(units, null, productTechClassification); const familyEvaluations = rankAuthoredTemplateFamilies(authoredTemplateFamilies, shape); const reversed = rankAuthoredTemplateFamilies([...authoredTemplateFamilies].reverse(), shape);
  const first = await routeEditorialInteriorsV1Export(record.input, decoder); const second = await routeEditorialInteriorsV1Export(record.input, decoder);
  const repeatedResultDeterministic = JSON.stringify(stableDecision(first)) === JSON.stringify(stableDecision(second));
  const normalizedAccountingComplete = normalized.sections.length + normalized.diagnostics.length === record.input.profile.sections.length;
  const sourceOrderingPreserved = normalized.sections.map((entry) => entry.section.id).join("|") === record.input.profile.sections.filter((section) => normalized.sections.some((entry) => entry.section === section)).map((section) => section.id).join("|");
  const visualProvenanceSafe = enriched.adapterInput.projectVisuals.every((visual) => visual.role === "project_image" && visual.provenance === "user_upload" && record.input.projects.some((project) => project.id === visual.projectId));
  const selected = first.mode === "authored" ? { mode: "authored" as const, familyId: first.familyId, packId: first.packId, pageCount: first.pdf.getNumberOfPages() } : { mode: "fallback" as const, reasons: first.reasons };
  const expectedMode = record.expectation.acceptableModes.includes(first.mode); const familyMatches = first.mode !== "authored" || !record.expectation.preferredFamily || first.familyId === record.expectation.preferredFamily;
  const unsafe = !normalizedAccountingComplete || !sourceOrderingPreserved || !visualProvenanceSafe || !repeatedResultDeterministic;
  const classification: CorpusClassification = unsafe ? "UNSAFE" : expectedMode && familyMatches ? first.mode === "fallback" ? "SAFE_FALLBACK" : "PASS" : "MISROUTE";
  return { corpusId: record.id, classification, productTechClassification, normalizedSectionRoles: normalized.sections.map((entry) => ({ id: entry.section.id, role: entry.role })), normalizationDiagnostics: normalized.diagnostics.map((entry) => ({ code: entry.code, path: entry.path })), normalizedUnitCounts: units.reduce<Record<string, number>>((counts, unit) => ({ ...counts, [unit.kind]: (counts[unit.kind] ?? 0) + 1 }), {}), contentShapeFacts: shape.facts, familyEvaluations, finalRankedOrder: familyEvaluations.map((entry) => entry.familyId), selected, coverage: first.mode === "authored" ? "passed" : "not_reached", preflight: first.mode === "authored" ? "passed" : first.reasons.some((reason) => reason.stage === "compatibility") ? "failed" : "not_reached", registryOrderIndependent: JSON.stringify(familyEvaluations) === JSON.stringify(reversed), repeatedResultDeterministic, normalizedAccountingComplete, sourceOrderingPreserved, visualProvenanceSafe };
};
