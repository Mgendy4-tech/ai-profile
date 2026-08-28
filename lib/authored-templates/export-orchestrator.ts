import type { jsPDF } from "jspdf";
import { normalizeAuthoredContentUnits, createContentShape } from "./content-shape";
import { enrichProductionContentForAuthoredTemplates, type EnrichmentDiagnostic, type ImageMetadataDecoder, type ProductionEnrichmentInput } from "./enrichment";
import { explainAuthoredTemplateFamilyRanking } from "./family-ranking";
import { authoredTemplateFamilies } from "./registry";
import { isCorporateServicesCompanyType, isProductTechCompanyType, normalizeProductionSectionRoles, type SectionRoleDiagnostic } from "./section-role-normalization";
import type { ContractIssue, PageRole } from "./types";
import { createVisualPortfolioDocumentPlan, prepareVisualPortfolioDocumentPlan, renderPreparedVisualPortfolioPlan, type VisualPortfolioPlanningIssue } from "./visual-portfolio-planner";
import { createCorporateServicesDocumentPlan, prepareCorporateServicesDocumentPlan, renderPreparedCorporateServicesPlan, type CorporateServicesPlanningIssue } from "./corporate-services-planner";
import { createProductTechDocumentPlan, prepareProductTechDocumentPlan, renderPreparedProductTechPlan, type ProductTechPlanningIssue } from "./product-tech-planner";
import { validateAuthoredEmbeddedImageLimits, validateAuthoredImageOperationalLimits, validateRenderedDocumentLimits } from "../production-limits";
import type { FamilyRankingExplanation } from "./library-types";
import { selectAuthoredCover, type AuthoredCoverContent, type CurrentFamilyId } from "./cover-library";

export type AuthoredExportFallbackReason = { stage: "operational" | "normalization" | "enrichment" | "ranking" | "planning" | "compatibility"; code: string; path: string; pageRole: PageRole | null };
export type AuthoredFallbackCategory = "expected_unsupported_content_shape" | "missing_authentic_asset" | "authored_capacity_incompatibility" | "ambiguous_semantic_normalization" | "runtime_system_error";
export const classifyAuthoredFallbackReason = (reason: AuthoredExportFallbackReason): AuthoredFallbackCategory => {
  if (reason.stage === "normalization") return "ambiguous_semantic_normalization";
  if ((reason.stage === "enrichment" && /image|asset/.test(reason.code)) || /project_(source_)?mismatch|normalized_project_mismatch/.test(reason.code)) return "missing_authentic_asset";
  if (reason.stage === "compatibility" || reason.stage === "operational" || /capacity|count|limit/.test(reason.code)) return "authored_capacity_incompatibility";
  if (reason.stage === "ranking" || reason.stage === "planning") return "expected_unsupported_content_shape";
  return "runtime_system_error";
};
export type AuthoredExportDecision =
  | { mode: "authored"; familyId: "visual-portfolio" | "corporate-services" | "product-tech"; packId: "editorial-interiors-v1" | "corporate-services-v1" | "product-tech-v1"; pdf: jsPDF; pageOrder: readonly string[]; reasons: []; ranking: FamilyRankingExplanation }
  | { mode: "fallback"; familyId: null; packId: "editorial-interiors-v1"; pdf: null; pageOrder: null; reasons: readonly AuthoredExportFallbackReason[]; ranking: FamilyRankingExplanation | null };

const fallback = (reasons: readonly AuthoredExportFallbackReason[], ranking: FamilyRankingExplanation | null = null): AuthoredExportDecision => ({ mode: "fallback", familyId: null, packId: "editorial-interiors-v1", pdf: null, pageOrder: null, reasons, ranking });
const normalizationReason = (issue: SectionRoleDiagnostic): AuthoredExportFallbackReason => ({ stage: "normalization", code: issue.code, path: issue.path, pageRole: issue.role === "services" || issue.role === "features" || issue.role === "use_cases" ? "capabilities" : issue.role === "projects" ? "project_grid" : issue.role === "narrative" || issue.role === "expertise" || issue.role === "approach" || issue.role === "supporting_narrative" ? "narrative" : null });
const enrichmentReason = (issue: EnrichmentDiagnostic): AuthoredExportFallbackReason => ({ stage: "enrichment", code: issue.code, path: issue.path, pageRole: issue.pageRole });
const planningReason = (issue: VisualPortfolioPlanningIssue | CorporateServicesPlanningIssue | ProductTechPlanningIssue): AuthoredExportFallbackReason => ({ stage: "planning", code: issue.code, path: issue.path, pageRole: null });
const compatibilityReason = (issue: ContractIssue): AuthoredExportFallbackReason => ({ stage: "compatibility", code: issue.code, path: issue.path, pageRole: null });
const renderedLimitReasons = (pdf: jsPDF): AuthoredExportFallbackReason[] => validateRenderedDocumentLimits(pdf.getNumberOfPages(), pdf.output("arraybuffer").byteLength).map((issue) => ({ stage: "operational", code: issue.code, path: issue.path, pageRole: null }));

export const routeEditorialInteriorsV1Export = async (input: ProductionEnrichmentInput, decodeDimensions?: ImageMetadataDecoder, imageBoundary: "source" | "optimized_embed" = "source"): Promise<AuthoredExportDecision> => {
  const operationalIssues = imageBoundary === "optimized_embed"
    ? validateAuthoredEmbeddedImageLimits(input.company, input.projects)
    : validateAuthoredImageOperationalLimits(input.company, input.projects);
  if (operationalIssues.length) return fallback(operationalIssues.map((issue) => ({ stage: "operational", code: issue.code, path: issue.path, pageRole: null })));
  const productTechSignal = isProductTechCompanyType(input.profile.companyType);
  const normalizedRoles = normalizeProductionSectionRoles(input.profile.sections, { productTech: productTechSignal && input.projects.length === 0, corporateServices: isCorporateServicesCompanyType(input.profile.companyType) });
  if (normalizedRoles.diagnostics.length > 0) return fallback(normalizedRoles.diagnostics.map(normalizationReason));
  const narrativeEntry = normalizedRoles.sections.find((entry) => entry.role === "narrative");
  const servicesEntry = normalizedRoles.sections.find((entry) => entry.role === "services") ?? normalizedRoles.sections.find((entry) => entry.role === "expertise");
  const corporateDetailEntries = normalizedRoles.sections.filter((entry): entry is typeof entry & { role: "expertise" | "approach" | "supporting_narrative" } => entry !== servicesEntry && (entry.role === "expertise" || entry.role === "approach" || entry.role === "supporting_narrative"));
  const featuresEntry = normalizedRoles.sections.find((entry) => entry.role === "features");
  const useCasesEntry = normalizedRoles.sections.find((entry) => entry.role === "use_cases");
  const projectsEntry = normalizedRoles.sections.find((entry) => entry.role === "projects");
  if (!narrativeEntry || (!servicesEntry && !featuresEntry)) return fallback([
    ...(!narrativeEntry ? [{ stage: "normalization" as const, code: "required_role_missing", path: "profile.sections", pageRole: "narrative" as const }] : []),
    ...(!servicesEntry && !featuresEntry ? [{ stage: "normalization" as const, code: "required_role_missing", path: "profile.sections", pageRole: "capabilities" as const }] : []),
  ]);
  if (projectsEntry && (projectsEntry.section.items.length !== input.projects.length || projectsEntry.section.items.some((item, index) => item.name !== input.projects[index]?.name))) return fallback([{ stage: "planning", code: "project_source_mismatch", path: `profile.sections.${input.profile.sections.indexOf(projectsEntry.section)}.items`, pageRole: "project_grid" }]);

  const enriched = await enrichProductionContentForAuthoredTemplates(input, decodeDimensions);
  const logoDiagnostics = enriched.diagnostics.filter((issue) => issue.path === "company.logoUrl");
  if (logoDiagnostics.length) return fallback(logoDiagnostics.map(enrichmentReason));
  const visualByProjectId = new Map(enriched.adapterInput.projectVisuals.map((visual) => [visual.projectId, visual]));
  const units = normalizeAuthoredContentUnits({ company: {}, sections: [
    { id: narrativeEntry.section.id, role: "narrative", content: narrativeEntry.section.content },
    ...(servicesEntry ? [{ id: servicesEntry.section.id, role: "services" as const, items: servicesEntry.section.items.map((_, index) => ({ id: `${servicesEntry.section.id}:item:${index}` })) }] : []),
    ...corporateDetailEntries.map((entry) => ({ id: entry.section.id, role: entry.role, content: entry.section.content })),
    ...(featuresEntry ? [{ id: featuresEntry.section.id, role: "features" as const, items: featuresEntry.section.items.map((_, index) => ({ id: `${featuresEntry.section.id}:item:${index}` })) }] : []),
    ...(useCasesEntry ? [{ id: useCasesEntry.section.id, role: "use_cases" as const, items: useCasesEntry.section.items.map((_, index) => ({ id: `${useCasesEntry.section.id}:item:${index}` })) }] : []),
  ], projects: input.projects.map((project) => ({ id: project.id, hasAuthenticImage: visualByProjectId.has(project.id) })) });
  const ranking = explainAuthoredTemplateFamilyRanking(authoredTemplateFamilies, createContentShape(units, null, productTechSignal));
  const selectedFamily = ranking.selectedFamilyId;
  if (!selectedFamily) return fallback([{ stage: "ranking", code: "no_eligible_authored_family", path: "contentShape", pageRole: null }], ranking);
  const coverSelection = selectAuthoredCover({ familyId: selectedFamily as CurrentFamilyId, companyName: input.company.name, companyType: input.profile.companyType, hasLogo: Boolean(enriched.adapterInput.company.logo) });
  if (!coverSelection.compatible) return fallback([{ stage: "compatibility", code: "cover_name_capacity_unsupported", path: "company.name", pageRole: "cover" }], ranking);
  const cover: AuthoredCoverContent = { contentId: "company", documentLabel: selectedFamily === "product-tech" ? "PRODUCT SYSTEM / 01" : selectedFamily === "corporate-services" ? "CORPORATE / SERVICES" : "COMPANY PROFILE", companyName: input.company.name, companyType: input.profile.companyType, paletteId: coverSelection.paletteId, ...(enriched.adapterInput.company.logo ? { logo: enriched.adapterInput.company.logo } : {}) };

  if (selectedFamily === "product-tech") {
    if (!featuresEntry) return fallback([{ stage: "planning", code: "source_content_not_covered", path: "profile.sections", pageRole: "capabilities" }], ranking);
    const planning = createProductTechDocumentPlan({ units,
      cover, coverTemplateId: coverSelection.templateId,
      overview: { contentId: narrativeEntry.section.id, title: narrativeEntry.section.title, body: narrativeEntry.section.content, supportingLine: narrativeEntry.section.description },
      featuresHeading: featuresEntry.section.title, featuresSupportingLine: featuresEntry.section.description,
      features: featuresEntry.section.items.map((item, index) => ({ contentId: `${featuresEntry.section.id}:item:${index}`, index: String(index + 1).padStart(2, "0"), title: item.name, description: item.description })),
      ...(useCasesEntry?.section.items.length ? { useCases: { heading: useCasesEntry.section.title, supportingLine: useCasesEntry.section.description, items: useCasesEntry.section.items.map((item, index) => ({ contentId: `${useCasesEntry.section.id}:item:${index}`, index: String(index + 1).padStart(2, "0"), title: item.name, description: item.description })) } } : {}),
    });
    if (!planning.compatible) return fallback(planning.issues.map(planningReason), ranking); const prepared = prepareProductTechDocumentPlan(planning.plan); if (!prepared.compatible) return fallback(prepared.issues.map(compatibilityReason), ranking); const rendered = renderPreparedProductTechPlan(prepared.prepared);
    const limits = renderedLimitReasons(rendered.pdf); if (limits.length) return fallback(limits, ranking); return { mode: "authored", familyId: "product-tech", packId: "product-tech-v1", pdf: rendered.pdf, pageOrder: planning.plan.pages.map((page) => page.templateId), reasons: [], ranking };
  }

  if (selectedFamily === "corporate-services") {
    if (!servicesEntry) return fallback([{ stage: "planning", code: "source_content_not_covered", path: "profile.sections", pageRole: "capabilities" }], ranking);
    const planning = createCorporateServicesDocumentPlan({
      units,
      cover, coverTemplateId: coverSelection.templateId,
      narrative: { contentId: narrativeEntry.section.id, title: narrativeEntry.section.title, body: narrativeEntry.section.content, supportingLine: narrativeEntry.section.description },
      ...(corporateDetailEntries.some((entry) => entry.role === "approach") ? {} : input.company.activities && input.company.experience ? { approach: { contentId: "company", heading: "Business approach", activities: input.company.activities, experience: input.company.experience } } : {}),
      servicesHeading: servicesEntry.section.title,
      servicesSupportingLine: servicesEntry.section.description,
      services: servicesEntry.section.items.map((item, index) => ({ contentId: `${servicesEntry.section.id}:item:${index}`, index: String(index + 1).padStart(2, "0"), title: item.name, description: item.description })),
      details: corporateDetailEntries.map((entry) => ({ contentId: entry.section.id, title: entry.section.title, body: entry.section.content, supportingLine: entry.section.description })),
    });
    if (!planning.compatible) return fallback(planning.issues.map(planningReason), ranking);
    const prepared = prepareCorporateServicesDocumentPlan(planning.plan);
    if (!prepared.compatible) return fallback(prepared.issues.map(compatibilityReason), ranking);
    const rendered = renderPreparedCorporateServicesPlan(prepared.prepared);
    const limits = renderedLimitReasons(rendered.pdf); if (limits.length) return fallback(limits, ranking); return { mode: "authored", familyId: "corporate-services", packId: "corporate-services-v1", pdf: rendered.pdf, pageOrder: planning.plan.pages.map((page) => page.templateId), reasons: [], ranking };
  }

  if (!servicesEntry) return fallback([{ stage: "planning", code: "source_content_not_covered", path: "profile.sections", pageRole: "capabilities" }], ranking);
  if (narrativeEntry.section.items.length > 1) return fallback([{ stage: "planning", code: "source_content_not_covered", path: `profile.sections.${input.profile.sections.indexOf(narrativeEntry.section)}.items`, pageRole: "narrative" }], ranking);
  if (servicesEntry.section.items.length !== 4 && !(servicesEntry.section.items.length === 6 && corporateDetailEntries.length > 0)) return fallback([{ stage: "planning", code: "capability_count_unsupported", path: `profile.sections.${input.profile.sections.indexOf(servicesEntry.section)}.items`, pageRole: "capabilities" }], ranking);
  const imageDiagnostics = enriched.diagnostics.filter((issue) => issue.code.startsWith("image_") || issue.code === "authentic_project_image_metadata_missing");
  if (imageDiagnostics.length > 0) return fallback(imageDiagnostics.map(enrichmentReason), ranking);
  const missingVisuals: AuthoredExportFallbackReason[] = input.projects.flatMap((project, index) => visualByProjectId.has(project.id) ? [] : [{ stage: "enrichment", code: "authentic_project_image_metadata_missing", path: `projects.${index}.imageUrl`, pageRole: "project_grid" }]);
  if (missingVisuals.length > 0) return fallback(missingVisuals, ranking);

  const firstProject = input.projects[0];
  if (!firstProject) return fallback([{ stage: "enrichment", code: "authentic_project_image_metadata_missing", path: "projects", pageRole: "cover" }], ranking);
  const toImage = (projectId: string) => {
    const visual = visualByProjectId.get(projectId);
    if (!visual) throw new Error(`Verified visual ${projectId} became unavailable.`);
    return { role: visual.role, provenance: visual.provenance, format: visual.format, width: visual.width, height: visual.height, source: visual.imageUrl, projectId } as const;
  };
  const planning = createVisualPortfolioDocumentPlan({
    units,
    cover, coverTemplateId: coverSelection.templateId,
    narrative: { contentId: narrativeEntry.section.id, title: narrativeEntry.section.title, body: narrativeEntry.section.content, ...(narrativeEntry.section.items[0] ? { secondaryBlock: { title: narrativeEntry.section.items[0].name, body: narrativeEntry.section.items[0].description } } : {}) },
    capabilities: { contentId: servicesEntry.section.id, eyebrow: "02 / CAPABILITIES", heading: servicesEntry.section.title, supportingLine: servicesEntry.section.description, capabilities: servicesEntry.section.items.slice(0, 4).map((item, index) => ({ index: String(index + 1).padStart(2, "0"), title: item.name, description: item.description, items: [] })) as unknown as readonly [
      { index: string; title: string; description: string; items: readonly string[] }, { index: string; title: string; description: string; items: readonly string[] }, { index: string; title: string; description: string; items: readonly string[] }, { index: string; title: string; description: string; items: readonly string[] },
    ] },
    ...(servicesEntry.section.items.length === 6 ? { capabilitiesSupporting: {
      contentId: `${servicesEntry.section.id}:supporting`, eyebrow: "CAPABILITIES / CONTINUED", heading: "Crafted around every interior.",
      capabilities: servicesEntry.section.items.slice(4).map((item, index) => ({ index: String(index + 5).padStart(2, "0"), title: item.name, description: item.description, items: [] })) as never,
      detail: { contentId: corporateDetailEntries[0].section.id, title: corporateDetailEntries[0].section.title, body: corporateDetailEntries[0].section.content },
      featuredProjectTitle: firstProject.name,
    } } : {}),
    details: corporateDetailEntries.map((entry) => ({ contentId: entry.section.id, title: entry.section.title, body: entry.section.content })),
    projects: input.projects.map((project) => ({ contentId: project.id, name: project.name, description: project.description, image: toImage(project.id) })),
  });
  if (!planning.compatible) return fallback(planning.issues.map(planningReason), ranking);
  const prepared = prepareVisualPortfolioDocumentPlan(planning.plan);
  if (!prepared.compatible) return fallback(prepared.issues.map(compatibilityReason), ranking);
  const rendered = renderPreparedVisualPortfolioPlan(prepared.prepared);
  const limits = renderedLimitReasons(rendered.pdf); if (limits.length) return fallback(limits, ranking); return { mode: "authored", familyId: "visual-portfolio", packId: "editorial-interiors-v1", pdf: rendered.pdf, pageOrder: planning.plan.pages.map((page) => page.templateId), reasons: [], ranking };
};
