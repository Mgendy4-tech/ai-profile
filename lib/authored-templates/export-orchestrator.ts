import type { jsPDF } from "jspdf";
import { normalizeAuthoredContentUnits, createContentShape } from "./content-shape";
import { enrichProductionContentForAuthoredTemplates, type EnrichmentDiagnostic, type ImageMetadataDecoder, type ProductionEnrichmentInput } from "./enrichment";
import { rankAuthoredTemplateFamilies } from "./family-ranking";
import { authoredTemplateFamilies } from "./registry";
import { isProductTechCompanyType, normalizeProductionSectionRoles, type SectionRoleDiagnostic } from "./section-role-normalization";
import type { ContractIssue, PageRole } from "./types";
import { createVisualPortfolioDocumentPlan, prepareVisualPortfolioDocumentPlan, renderPreparedVisualPortfolioPlan, type VisualPortfolioPlanningIssue } from "./visual-portfolio-planner";
import { createCorporateServicesDocumentPlan, prepareCorporateServicesDocumentPlan, renderPreparedCorporateServicesPlan, type CorporateServicesPlanningIssue } from "./corporate-services-planner";
import { createProductTechDocumentPlan, prepareProductTechDocumentPlan, renderPreparedProductTechPlan, type ProductTechPlanningIssue } from "./product-tech-planner";

export type AuthoredExportFallbackReason = { stage: "normalization" | "enrichment" | "ranking" | "planning" | "compatibility"; code: string; path: string; pageRole: PageRole | null };
export type AuthoredExportDecision =
  | { mode: "authored"; familyId: "visual-portfolio" | "corporate-services" | "product-tech"; packId: "editorial-interiors-v1" | "corporate-services-v1" | "product-tech-v1"; pdf: jsPDF; pageOrder: readonly string[]; reasons: [] }
  | { mode: "fallback"; familyId: null; packId: "editorial-interiors-v1"; pdf: null; pageOrder: null; reasons: readonly AuthoredExportFallbackReason[] };

const fallback = (reasons: readonly AuthoredExportFallbackReason[]): AuthoredExportDecision => ({ mode: "fallback", familyId: null, packId: "editorial-interiors-v1", pdf: null, pageOrder: null, reasons });
const normalizationReason = (issue: SectionRoleDiagnostic): AuthoredExportFallbackReason => ({ stage: "normalization", code: issue.code, path: issue.path, pageRole: issue.role === "services" || issue.role === "features" || issue.role === "use_cases" ? "capabilities" : issue.role === "projects" ? "project_grid" : issue.role });
const enrichmentReason = (issue: EnrichmentDiagnostic): AuthoredExportFallbackReason => ({ stage: "enrichment", code: issue.code, path: issue.path, pageRole: issue.pageRole });
const planningReason = (issue: VisualPortfolioPlanningIssue | CorporateServicesPlanningIssue | ProductTechPlanningIssue): AuthoredExportFallbackReason => ({ stage: "planning", code: issue.code, path: issue.path, pageRole: null });
const compatibilityReason = (issue: ContractIssue): AuthoredExportFallbackReason => ({ stage: "compatibility", code: issue.code, path: issue.path, pageRole: null });

export const routeEditorialInteriorsV1Export = async (input: ProductionEnrichmentInput, decodeDimensions?: ImageMetadataDecoder): Promise<AuthoredExportDecision> => {
  const productTechSignal = isProductTechCompanyType(input.profile.companyType);
  const normalizedRoles = normalizeProductionSectionRoles(input.profile.sections, { productTech: productTechSignal && input.projects.length === 0 });
  if (normalizedRoles.diagnostics.length > 0) return fallback(normalizedRoles.diagnostics.map(normalizationReason));
  const narrativeEntry = normalizedRoles.sections.find((entry) => entry.role === "narrative");
  const servicesEntry = normalizedRoles.sections.find((entry) => entry.role === "services");
  const featuresEntry = normalizedRoles.sections.find((entry) => entry.role === "features");
  const useCasesEntry = normalizedRoles.sections.find((entry) => entry.role === "use_cases");
  const projectsEntry = normalizedRoles.sections.find((entry) => entry.role === "projects");
  if (!narrativeEntry || (!servicesEntry && !featuresEntry)) return fallback([
    ...(!narrativeEntry ? [{ stage: "normalization" as const, code: "required_role_missing", path: "profile.sections", pageRole: "narrative" as const }] : []),
    ...(!servicesEntry && !featuresEntry ? [{ stage: "normalization" as const, code: "required_role_missing", path: "profile.sections", pageRole: "capabilities" as const }] : []),
  ]);
  if (projectsEntry && (projectsEntry.section.items.length !== input.projects.length || projectsEntry.section.items.some((item, index) => item.name !== input.projects[index]?.name))) return fallback([{ stage: "planning", code: "project_source_mismatch", path: `profile.sections.${input.profile.sections.indexOf(projectsEntry.section)}.items`, pageRole: "project_grid" }]);

  const enriched = await enrichProductionContentForAuthoredTemplates(input, decodeDimensions);
  const visualByProjectId = new Map(enriched.adapterInput.projectVisuals.map((visual) => [visual.projectId, visual]));
  const units = normalizeAuthoredContentUnits({ company: {}, sections: [
    { id: narrativeEntry.section.id, role: "narrative", content: narrativeEntry.section.content },
    ...(servicesEntry ? [{ id: servicesEntry.section.id, role: "services" as const, items: servicesEntry.section.items.map((_, index) => ({ id: `${servicesEntry.section.id}:item:${index}` })) }] : []),
    ...(featuresEntry ? [{ id: featuresEntry.section.id, role: "features" as const, items: featuresEntry.section.items.map((_, index) => ({ id: `${featuresEntry.section.id}:item:${index}` })) }] : []),
    ...(useCasesEntry ? [{ id: useCasesEntry.section.id, role: "use_cases" as const, items: useCasesEntry.section.items.map((_, index) => ({ id: `${useCasesEntry.section.id}:item:${index}` })) }] : []),
  ], projects: input.projects.map((project) => ({ id: project.id, hasAuthenticImage: visualByProjectId.has(project.id) })) });
  const ranking = rankAuthoredTemplateFamilies(authoredTemplateFamilies, createContentShape(units, null, productTechSignal));
  const selectedFamily = ranking[0]?.familyId;
  if (!selectedFamily) return fallback([{ stage: "ranking", code: "no_eligible_authored_family", path: "contentShape", pageRole: null }]);

  if (selectedFamily === "product-tech") {
    if (!featuresEntry) return fallback([{ stage: "planning", code: "source_content_not_covered", path: "profile.sections", pageRole: "capabilities" }]);
    const planning = createProductTechDocumentPlan({ units,
      cover: { contentId: "company", documentLabel: "PRODUCT PROFILE", companyName: input.company.name, companyType: input.profile.companyType },
      overview: { contentId: narrativeEntry.section.id, title: narrativeEntry.section.title, body: narrativeEntry.section.content, supportingLine: narrativeEntry.section.description },
      featuresHeading: featuresEntry.section.title, featuresSupportingLine: featuresEntry.section.description,
      features: featuresEntry.section.items.map((item, index) => ({ contentId: `${featuresEntry.section.id}:item:${index}`, index: String(index + 1).padStart(2, "0"), title: item.name, description: item.description })),
      ...(useCasesEntry?.section.items.length ? { useCases: { heading: useCasesEntry.section.title, supportingLine: useCasesEntry.section.description, items: useCasesEntry.section.items.map((item, index) => ({ contentId: `${useCasesEntry.section.id}:item:${index}`, index: String(index + 1).padStart(2, "0"), title: item.name, description: item.description })) } } : {}),
    });
    if (!planning.compatible) return fallback(planning.issues.map(planningReason)); const prepared = prepareProductTechDocumentPlan(planning.plan); if (!prepared.compatible) return fallback(prepared.issues.map(compatibilityReason)); const rendered = renderPreparedProductTechPlan(prepared.prepared);
    return { mode: "authored", familyId: "product-tech", packId: "product-tech-v1", pdf: rendered.pdf, pageOrder: planning.plan.pages.map((page) => page.templateId), reasons: [] };
  }

  if (selectedFamily === "corporate-services") {
    if (!servicesEntry) return fallback([{ stage: "planning", code: "source_content_not_covered", path: "profile.sections", pageRole: "capabilities" }]);
    const planning = createCorporateServicesDocumentPlan({
      units,
      cover: { contentId: "company", documentLabel: "COMPANY PROFILE", companyName: input.company.name, companyType: input.profile.companyType },
      narrative: { contentId: narrativeEntry.section.id, title: narrativeEntry.section.title, body: narrativeEntry.section.content, supportingLine: narrativeEntry.section.description },
      ...(input.company.activities && input.company.experience ? { approach: { contentId: "company", heading: "Business approach", activities: input.company.activities, experience: input.company.experience } } : {}),
      servicesHeading: servicesEntry.section.title,
      servicesSupportingLine: servicesEntry.section.description,
      services: servicesEntry.section.items.map((item, index) => ({ contentId: `${servicesEntry.section.id}:item:${index}`, index: String(index + 1).padStart(2, "0"), title: item.name, description: item.description })),
    });
    if (!planning.compatible) return fallback(planning.issues.map(planningReason));
    const prepared = prepareCorporateServicesDocumentPlan(planning.plan);
    if (!prepared.compatible) return fallback(prepared.issues.map(compatibilityReason));
    const rendered = renderPreparedCorporateServicesPlan(prepared.prepared);
    return { mode: "authored", familyId: "corporate-services", packId: "corporate-services-v1", pdf: rendered.pdf, pageOrder: planning.plan.pages.map((page) => page.templateId), reasons: [] };
  }

  if (!servicesEntry) return fallback([{ stage: "planning", code: "source_content_not_covered", path: "profile.sections", pageRole: "capabilities" }]);
  if (narrativeEntry.section.items.length > 1) return fallback([{ stage: "planning", code: "source_content_not_covered", path: `profile.sections.${input.profile.sections.indexOf(narrativeEntry.section)}.items`, pageRole: "narrative" }]);
  if (servicesEntry.section.items.length !== 4) return fallback([{ stage: "planning", code: "capability_count_unsupported", path: `profile.sections.${input.profile.sections.indexOf(servicesEntry.section)}.items`, pageRole: "capabilities" }]);
  const imageDiagnostics = enriched.diagnostics.filter((issue) => issue.code.startsWith("image_") || issue.code === "authentic_project_image_metadata_missing");
  if (imageDiagnostics.length > 0) return fallback(imageDiagnostics.map(enrichmentReason));
  const missingVisuals: AuthoredExportFallbackReason[] = input.projects.flatMap((project, index) => visualByProjectId.has(project.id) ? [] : [{ stage: "enrichment", code: "authentic_project_image_metadata_missing", path: `projects.${index}.imageUrl`, pageRole: "project_grid" }]);
  if (missingVisuals.length > 0) return fallback(missingVisuals);

  const firstProject = input.projects[0];
  if (!firstProject) return fallback([{ stage: "enrichment", code: "authentic_project_image_metadata_missing", path: "projects", pageRole: "cover" }]);
  const toImage = (projectId: string) => {
    const visual = visualByProjectId.get(projectId);
    if (!visual) throw new Error(`Verified visual ${projectId} became unavailable.`);
    return { role: visual.role, provenance: visual.provenance, format: visual.format, width: visual.width, height: visual.height, source: visual.imageUrl, projectId } as const;
  };
  const planning = createVisualPortfolioDocumentPlan({
    units,
    cover: { contentId: "company", documentLabel: "COMPANY PROFILE", companyName: input.company.name, hero: toImage(firstProject.id) },
    narrative: { contentId: narrativeEntry.section.id, title: narrativeEntry.section.title, body: narrativeEntry.section.content, ...(narrativeEntry.section.items[0] ? { secondaryBlock: { title: narrativeEntry.section.items[0].name, body: narrativeEntry.section.items[0].description } } : {}) },
    capabilities: { contentId: servicesEntry.section.id, eyebrow: "02 / CAPABILITIES", heading: servicesEntry.section.title, supportingLine: servicesEntry.section.description, capabilities: servicesEntry.section.items.map((item, index) => ({ index: String(index + 1).padStart(2, "0"), title: item.name, description: item.description, items: [] })) as unknown as readonly [
      { index: string; title: string; description: string; items: readonly string[] }, { index: string; title: string; description: string; items: readonly string[] }, { index: string; title: string; description: string; items: readonly string[] }, { index: string; title: string; description: string; items: readonly string[] },
    ] },
    projects: input.projects.map((project) => ({ contentId: project.id, name: project.name, description: project.description, image: toImage(project.id) })),
  });
  if (!planning.compatible) return fallback(planning.issues.map(planningReason));
  const prepared = prepareVisualPortfolioDocumentPlan(planning.plan);
  if (!prepared.compatible) return fallback(prepared.issues.map(compatibilityReason));
  const rendered = renderPreparedVisualPortfolioPlan(prepared.prepared);
  return { mode: "authored", familyId: "visual-portfolio", packId: "editorial-interiors-v1", pdf: rendered.pdf, pageOrder: planning.plan.pages.map((page) => page.templateId), reasons: [] };
};
