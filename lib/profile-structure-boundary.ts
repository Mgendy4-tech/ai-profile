import { isCorporateServicesCompanyType, isProductTechCompanyType, normalizeProductionSectionRoles } from "./authored-templates/section-role-normalization";
import type { SelectedProfileSection } from "./generated-profile-boundary";
import { productTechOverviewTemplate } from "./authored-templates/packs/product-tech-v1/overview";
import { productFeaturePrimaryTemplates } from "./authored-templates/packs/product-tech-v1/features";
import { productUseCasePrimaryTemplates } from "./authored-templates/packs/product-tech-v1/use-cases";

export type AnalyzedProfileStructure = { companyType: string; recommendedSections: SelectedProfileSection[] };
export type StructureBoundaryResult = { valid: true; structure: AnalyzedProfileStructure; diagnostics: [] } | { valid: false; structure: null; diagnostics: readonly { code: string; path: string }[] };

export const validateAnalyzedProfileStructure = (value: unknown): StructureBoundaryResult => {
  if (!value || typeof value !== "object") return { valid: false, structure: null, diagnostics: [{ code: "analyzed_structure_invalid", path: "structure" }] };
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.companyType !== "string" || !Array.isArray(candidate.recommendedSections) || !candidate.recommendedSections.every((section) => section && typeof section === "object" && typeof section.id === "string" && typeof section.displayTitle === "string" && typeof section.description === "string")) {
    return { valid: false, structure: null, diagnostics: [{ code: "analyzed_structure_invalid", path: "structure" }] };
  }
  const structure = candidate as AnalyzedProfileStructure;
  const corporate = isCorporateServicesCompanyType(structure.companyType); const product = isProductTechCompanyType(structure.companyType);
  if (!corporate && !product) return { valid: true, structure, diagnostics: [] };
  const normalized = normalizeProductionSectionRoles(structure.recommendedSections.map((section) => ({ ...section, title: section.displayTitle, content: "", items: [] })), { corporateServices: corporate, productTech: product });
  const roles = new Set(normalized.sections.map((entry) => entry.role));
  const diagnostics = [
    ...normalized.diagnostics.map((entry) => ({ code: entry.code, path: entry.path })),
    ...(!roles.has("narrative") ? [{ code: "required_role_missing", path: "recommendedSections" }] : []),
    ...(!(corporate ? roles.has("services") : roles.has("features")) ? [{ code: "required_role_missing", path: "recommendedSections" }] : []),
  ];
  if (product) structure.recommendedSections.forEach((section, index) => {
    const role = normalized.sections.find((entry) => entry.section.id === section.id)?.role;
    const result = role === "narrative" ? productTechOverviewTemplate.prepare({ contentId: section.id, title: section.displayTitle, supportingLine: section.description, body: "Source-backed product overview." }) : role === "features" ? productFeaturePrimaryTemplates[0].prepare({ contentId: section.id, heading: section.displayTitle, supportingLine: section.description, features: [{ contentId: `${section.id}:fixture`, index: "01", title: "Source feature", description: "Source-backed feature." }] }) : role === "use_cases" ? productUseCasePrimaryTemplates[0].prepare({ contentId: section.id, heading: section.displayTitle, supportingLine: section.description, useCases: [{ contentId: `${section.id}:fixture`, index: "01", title: "Source use case", description: "Source-backed use case." }] }) : null;
    if (result && !result.compatible) diagnostics.push({ code: "analyzed_section_capacity_unsupported", path: `recommendedSections.${index}` });
  });
  return diagnostics.length ? { valid: false, structure: null, diagnostics } : { valid: true, structure, diagnostics: [] };
};

export const analyzedStructureErrorMessage = "The proposed profile structure is not compatible with the supported authored sections. Please analyze it again.";
