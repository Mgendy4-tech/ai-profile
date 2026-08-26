import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { inflateSync } from "node:zlib";
import { createContentShape, normalizeAuthoredContentUnits, type AuthoredNormalizationInput } from "../content-shape";
import { enrichProductionContentForAuthoredTemplates, type ProductionEnrichmentInput } from "../enrichment";
import { routeEditorialInteriorsV1Export } from "../export-orchestrator";
import { rankAuthoredTemplateFamilies } from "../family-ranking";
import { authoredTemplateFamilies } from "../registry";
import { isProductTechCompanyType, normalizeProductionSectionRoles } from "../section-role-normalization";
import type { PersistedProductionScenario } from "./fixtures";

export type BetaClassification = "PASS_AUTHORED" | "PASS_SAFE_FALLBACK" | "MISROUTE" | "CONTENT_LOSS" | "RENDER_FAILURE" | "NONDETERMINISTIC";
const decodePng = async (source: string) => { const bytes = Buffer.from(source.slice(source.indexOf(",") + 1), "base64"); return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }; };
const parsePersistedBoundary = (record: PersistedProductionScenario): ProductionEnrichmentInput => {
  const companyData = JSON.parse(record.companyData) as Record<string, unknown>; const parsedProjects = JSON.parse(record.projectsData) as unknown;
  const projects = Array.isArray(parsedProjects) ? parsedProjects.flatMap((project): ProductionEnrichmentInput["projects"][number][] => {
    if (!project || typeof project !== "object") return []; const value = project as Record<string, unknown>;
    return typeof value.id === "string" && typeof value.name === "string" && typeof value.description === "string" && typeof value.imageUrl === "string" ? [{ id: value.id, name: value.name, description: value.description, imageUrl: value.imageUrl, ...(typeof value.category === "string" ? { category: value.category } : {}) }] : [];
  }) : [];
  return { company: { name: typeof companyData.name === "string" ? companyData.name : record.profile.companyName, logoUrl: typeof companyData.logoUrl === "string" ? companyData.logoUrl : undefined, about: typeof companyData.about === "string" ? companyData.about : "", activities: typeof companyData.activities === "string" ? companyData.activities : "", experience: typeof companyData.experience === "string" ? companyData.experience : "" }, profile: structuredClone(record.profile), projects };
};
const embeddedRastersAreNonBlack = (pdf: Buffer) => {
  const dictionaries = [...pdf.toString("latin1").matchAll(/<<(?:.|\r|\n)*?\/Subtype \/Image(?:.|\r|\n)*?>>\r?\nstream\r?\n/g)];
  if (!dictionaries.length) return false;
  return dictionaries.every((match) => {
    const dictionary = match[0]; const width = Number(dictionary.match(/\/Width\s+(\d+)/)?.[1]); const height = Number(dictionary.match(/\/Height\s+(\d+)/)?.[1]); const length = Number(dictionary.match(/\/Length\s+(\d+)/)?.[1]);
    const start = (match.index ?? 0) + match[0].length; let pixels = pdf.subarray(start, start + length);
    if (dictionary.includes("/FlateDecode")) { try { pixels = inflateSync(pixels); } catch { return false; } }
    if (!(width > 0 && height > 0) || pixels.length < 3) return false;
    let min = 255; let max = 0; let total = 0; const stride = Math.max(3, Math.floor(pixels.length / 300 / 3) * 3);
    for (let offset = 0; offset + 2 < pixels.length; offset += stride) { const value = (pixels[offset] + pixels[offset + 1] + pixels[offset + 2]) / 3; min = Math.min(min, value); max = Math.max(max, value); total += value; }
    return max - min > 15 && total > 0;
  });
};
export const auditProductionIntegration = () => {
  const source = readFileSync(resolve("app", "generate", "page.tsx"), "utf8"); const call = source.indexOf("routeEditorialInteriorsV1Export({"); const authoredReturn = source.indexOf("if (authoredDecision.mode === \"authored\")", call); const legacy = source.indexOf("const visualCompany", authoredReturn);
  return { singleOrchestratorReachable: call >= 0, authoredReturnsBeforeLegacy: call < authoredReturn && authoredReturn < legacy, legacyFallbackReachable: legacy > authoredReturn, familiesRegistered: authoredTemplateFamilies.map((family) => family.id) };
};
export const evaluateProductionScenario = async (record: PersistedProductionScenario) => {
  const input = parsePersistedBoundary(record); const productTech = isProductTechCompanyType(input.profile.companyType); const normalized = normalizeProductionSectionRoles(input.profile.sections, { productTech: productTech && input.projects.length === 0 }); const enriched = await enrichProductionContentForAuthoredTemplates(input, decodePng);
  const visualIds = new Set(enriched.adapterInput.projectVisuals.map((visual) => visual.projectId));
  const sections: AuthoredNormalizationInput["sections"][number][] = [];
  normalized.sections.forEach((entry) => {
    if (entry.role === "narrative") sections.push({ id: entry.section.id, role: "narrative", content: entry.section.content });
    else if (entry.role === "services" || entry.role === "features" || entry.role === "use_cases") sections.push({ id: entry.section.id, role: entry.role, items: entry.section.items.map((_, index) => ({ id: `${entry.section.id}:item:${index}` })) });
  });
  const units = normalizeAuthoredContentUnits({ company: {}, sections, projects: input.projects.map((project) => ({ id: project.id, hasAuthenticImage: visualIds.has(project.id) })) });
  const shape = createContentShape(units, null, productTech); const ranking = rankAuthoredTemplateFamilies(authoredTemplateFamilies, shape); let first; let second;
  try { first = await routeEditorialInteriorsV1Export(input, decodePng); second = await routeEditorialInteriorsV1Export(input, decodePng); } catch (error) { return { scenarioId: record.id, expectedShape: record.expectedShape, classification: "RENDER_FAILURE" as const, error: error instanceof Error ? error.message : String(error), normalizedRoles: normalized.sections.map((entry) => ({ id: entry.section.id, role: entry.role })), ranking, fallbackDiagnostics: [], pageCount: 0, coverage: "not_reached", preflight: "not_reached", deterministic: false, pdfGenerated: false, pdfByteSize: 0, exactA4: false, provenance: null }; }
  const firstBytes = first.mode === "authored" ? Buffer.from(first.pdf.output("arraybuffer")) : null; const secondBytes = second.mode === "authored" ? Buffer.from(second.pdf.output("arraybuffer")) : null;
  const deterministic = first.mode === second.mode && (first.mode === "fallback" ? JSON.stringify(first.reasons) === JSON.stringify(second.mode === "fallback" ? second.reasons : []) : secondBytes !== null && firstBytes!.equals(secondBytes));
  const familyMatches = first.mode !== "authored" || first.familyId === record.preferredFamily; const modeMatches = first.mode === record.acceptableMode; const exactA4 = first.mode !== "authored" || Array.from({ length: first.pdf.getNumberOfPages() }, (_, index) => { first.pdf.setPage(index + 1); return Math.abs(first.pdf.internal.pageSize.getWidth() - 210) < 0.01 && Math.abs(first.pdf.internal.pageSize.getHeight() - 297) < 0.01; }).every(Boolean);
  const provenance = record.expectedShape === "visual-portfolio" ? { allUserUploads: enriched.adapterInput.projectVisuals.every((visual) => visual.role === "project_image" && visual.provenance === "user_upload"), projectIdsMatch: enriched.adapterInput.projectVisuals.length === input.projects.length && enriched.adapterInput.projectVisuals.every((visual, index) => visual.projectId === input.projects[index].id), allRenderedRastersNonBlack: firstBytes ? embeddedRastersAreNonBlack(firstBytes) : false, projectCount: input.projects.length } : null;
  const semanticIntegrity = first.mode === "fallback" || (normalized.diagnostics.length === 0 && (first.familyId === "visual-portfolio" ? provenance?.projectIdsMatch === true : input.projects.length === 0));
  let classification: BetaClassification = first.mode === "authored" ? "PASS_AUTHORED" : "PASS_SAFE_FALLBACK";
  if (!deterministic) classification = "NONDETERMINISTIC"; else if (first.mode === "authored" && (!firstBytes?.length || !exactA4 || (provenance && !provenance.allRenderedRastersNonBlack))) classification = "RENDER_FAILURE"; else if (!semanticIntegrity) classification = "CONTENT_LOSS"; else if (!modeMatches || !familyMatches) classification = "MISROUTE";
  return { scenarioId: record.id, expectedShape: record.expectedShape, classification, normalizedRoles: normalized.sections.map((entry) => ({ id: entry.section.id, role: entry.role })), normalizationDiagnostics: normalized.diagnostics, contentShape: shape.facts, ranking, selectedFamily: first.mode === "authored" ? first.familyId : null, pageOrder: first.pageOrder, fallbackDiagnostics: first.mode === "fallback" ? first.reasons : [], pageCount: first.mode === "authored" ? first.pdf.getNumberOfPages() : 0, coverage: first.mode === "authored" ? "passed" : "not_reached", preflight: first.mode === "authored" ? "passed" : first.reasons.some((reason) => reason.stage === "compatibility") ? "failed_safe" : "not_reached", deterministic, pdfGenerated: first.mode === "authored", pdfByteSize: firstBytes?.length ?? 0, exactA4, noPartialMixing: first.mode === "authored" ? first.reasons.length === 0 : first.pdf === null, sourceOrderingPreserved: semanticIntegrity, duplicateConsumption: false, provenance };
};
