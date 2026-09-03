import { jsPDF } from "jspdf";
import { validateDocumentCoverage } from "./coverage";
import { validateAuthoredDocumentPlan } from "./document-plan";
import type { AuthoredDocumentPlan, CoverageIssue, NormalizedContentUnit } from "./library-types";
import { productTechV1Pack } from "./packs/product-tech-v1";
import type { ProductFeature, ProductFeaturesPageContent, ProductOverviewContent, ProductTechCoverContent, ProductUseCase, ProductUseCasesPageContent } from "./packs/product-tech-v1/content";
import type { AuthoredPageTemplate, ContractIssue, TemplateInstance, TemplateRenderAudit } from "./types";
import type { AuthoredCoverContent, CoverTemplateId } from "./cover-library";

export type ProductTechPlanningInput = { units: readonly NormalizedContentUnit[]; cover: AuthoredCoverContent | ProductTechCoverContent; coverTemplateId?: CoverTemplateId; overview: ProductOverviewContent; featuresHeading: string; featuresSupportingLine: string; features: readonly ProductFeature[]; useCases?: { heading: string; supportingLine: string; items: readonly ProductUseCase[] } };
export type ProductTechPlanningIssue = CoverageIssue | { code: "feature_count_unsupported" | "normalized_feature_mismatch" | "normalized_use_case_mismatch" | "project_content_unsupported" | "service_content_unsupported" | "invalid_document_plan"; path: string; message: string };
export type ProductTechPlanResult = { compatible: true; plan: AuthoredDocumentPlan; issues: [] } | { compatible: false; plan: null; issues: readonly ProductTechPlanningIssue[] };

export const createProductTechDocumentPlan = (input: ProductTechPlanningInput): ProductTechPlanResult => {
  if (!input.features.length) return { compatible: false, plan: null, issues: [{ code: "feature_count_unsupported", path: "features", message: "Product / Tech requires at least one source-backed feature." }] };
  if (input.units.some((unit) => unit.kind === "project")) return { compatible: false, plan: null, issues: [{ code: "project_content_unsupported", path: "units", message: "Product / Tech V1 does not consume project units." }] };
  if (input.units.some((unit) => unit.kind === "service_capability")) return { compatible: false, plan: null, issues: [{ code: "service_content_unsupported", path: "units", message: "Product / Tech V1 does not silently reinterpret normalized service units." }] };
  const normalizedFeatures = input.units.filter((unit) => unit.kind === "product_feature"); const normalizedUseCases = input.units.filter((unit) => unit.kind === "use_case");
  if (normalizedFeatures.length !== input.features.length || normalizedFeatures.some((unit, index) => unit.id !== input.features[index].contentId)) return { compatible: false, plan: null, issues: [{ code: "normalized_feature_mismatch", path: "features", message: "Normalized feature units must match candidate features in source order." }] };
  const useCases = input.useCases?.items ?? [];
  if (normalizedUseCases.length !== useCases.length || normalizedUseCases.some((unit, index) => unit.id !== useCases[index].contentId)) return { compatible: false, plan: null, issues: [{ code: "normalized_use_case_mismatch", path: "useCases", message: "Normalized use-case units must match candidate use cases in source order." }] };
  const company = input.units.find((unit) => unit.kind === "company_identity"); const narrative = input.units.find((unit) => unit.kind === "narrative_section");
  const pages: AuthoredDocumentPlan["pages"][number][] = [
    { pageId: "cover", templateId: input.coverTemplateId ?? "product-tech-v1.cover", pageRole: "cover", candidate: input.cover, claims: company ? [{ contentId: company.id, mode: "consume", slotId: "companyName" }] : [] },
    { pageId: "overview", templateId: "product-tech-v1.overview", pageRole: "narrative", candidate: input.overview, claims: narrative ? [{ contentId: narrative.id, mode: "consume", slotId: "body" }] : [] },
  ];
  const addChunks = <T extends ProductFeature | ProductUseCase>(items: readonly T[], limit: number, primaryPrefix: string, continuationPrefix: string, kind: "features" | "useCases") => {
    let offset = 0; let sequence = 0;
    while (offset < items.length) { const count = Math.min(limit, items.length - offset); const chunk = items.slice(offset, offset + count); const candidate: ProductFeaturesPageContent | ProductUseCasesPageContent = kind === "features" ? { contentId: `features-page:${sequence}`, heading: input.featuresHeading, supportingLine: input.featuresSupportingLine, features: chunk as readonly ProductFeature[] } : { contentId: `use-cases-page:${sequence}`, heading: input.useCases!.heading, supportingLine: input.useCases!.supportingLine, useCases: chunk as readonly ProductUseCase[] }; pages.push({ pageId: `${kind}:${sequence}`, templateId: `${sequence ? continuationPrefix : primaryPrefix}${count}`, pageRole: sequence ? "continuation" : "capabilities", candidate, claims: chunk.map((item, index) => ({ contentId: item.contentId, mode: "consume", slotId: `${kind}.${index}` })) }); offset += count; sequence += 1; }
  };
  addChunks(input.features, 4, "product-tech-v1.features-", "product-tech-v1.features-continuation-", "features");
  if (useCases.length) addChunks(useCases, 3, "product-tech-v1.use-cases-", "product-tech-v1.use-cases-continuation-", "useCases");
  pages.push({ pageId: "closing", templateId: "product-tech-v1.closing", pageRole: "closing", candidate: { contentId: input.cover.contentId, companyName: input.cover.companyName, descriptor: input.cover.companyType, logo: input.cover.logo }, claims: company ? [{ contentId: company.id, mode: "reference", slotId: "companyName" }] : [] });
  const plan: AuthoredDocumentPlan = { familyId: "product-tech", packId: productTechV1Pack.id, pages };
  const structure = validateAuthoredDocumentPlan(plan, [productTechV1Pack]); if (structure.length) return { compatible: false, plan: null, issues: structure.map((issue) => ({ code: "invalid_document_plan", path: issue.path, message: issue.message })) };
  const coverage = validateDocumentCoverage(input.units, plan); return coverage.complete ? { compatible: true, plan, issues: [] } : { compatible: false, plan: null, issues: coverage.issues };
};

export type PreparedProductTechPlan = { plan: AuthoredDocumentPlan; instances: readonly TemplateInstance<object>[] };
export const prepareProductTechDocumentPlan = (plan: AuthoredDocumentPlan): { compatible: true; prepared: PreparedProductTechPlan; issues: [] } | { compatible: false; prepared: null; issues: readonly ContractIssue[] } => { const instances: TemplateInstance<object>[] = []; const issues: ContractIssue[] = []; plan.pages.forEach((page) => { const template = productTechV1Pack.templates.find((entry) => entry.id === page.templateId) as AuthoredPageTemplate<object> | undefined; if (!template) throw new Error(`Unregistered template ${page.templateId}.`); const result = template.prepare(page.candidate); if (result.compatible) instances.push(result.instance); else issues.push(...result.issues); }); return issues.length ? { compatible: false, prepared: null, issues } : { compatible: true, prepared: { plan, instances }, issues: [] }; };
export const renderPreparedProductTechPlan = (prepared: PreparedProductTechPlan): { pdf: jsPDF; audits: readonly TemplateRenderAudit[] } => { const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" }); pdf.setCreationDate(new Date("2000-01-01T00:00:00.000Z")); pdf.setFileId("00000000000000000000000000000000"); const audits: TemplateRenderAudit[] = []; prepared.plan.pages.forEach((page, index) => { if (index) pdf.addPage("a4", "portrait"); const template = productTechV1Pack.templates.find((entry) => entry.id === page.templateId) as AuthoredPageTemplate<object> | undefined; if (!template) throw new Error(`Unregistered template ${page.templateId}.`); audits.push(template.render(pdf, prepared.instances[index])); }); return { pdf, audits }; };
