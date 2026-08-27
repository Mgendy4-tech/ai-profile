import { editorialInteriorsV1Pack } from "./packs/editorial-interiors-v1";
import { corporateServicesV1Pack } from "./packs/corporate-services-v1";
import { productTechV1Pack } from "./packs/product-tech-v1";
import type { AuthoredTemplateFamily } from "./library-types";

export const authoredTemplatePacks = [editorialInteriorsV1Pack, corporateServicesV1Pack, productTechV1Pack] as const;

export type AuthoredTemplatePackId = (typeof authoredTemplatePacks)[number]["id"];

export const getAuthoredTemplatePack = (id: AuthoredTemplatePackId) =>
  authoredTemplatePacks.find((pack) => pack.id === id) ?? null;

export const visualPortfolioFamily = {
  id: "visual-portfolio",
  label: "Visual / Portfolio",
  priority: 100,
  packs: [editorialInteriorsV1Pack],
  evaluate: (shape) => ({
    eligible: shape.facts.projectCount > 0 && shape.facts.authenticProjectImageCount > 0,
    reasons: [
      {
        code: "authentic_project_images_available",
        contribution: shape.facts.authenticProjectImageCoverage >= 0.75 ? 3 : 1,
        evidenceContentIds: [],
      },
      {
        code: "project_content_available",
        contribution: shape.facts.projectCount > 0 ? 2 : -3,
        evidenceContentIds: [],
      },
    ],
  }),
} as const satisfies AuthoredTemplateFamily;

export const corporateServicesFamily = {
  id: "corporate-services",
  label: "Corporate / Services",
  priority: 90,
  packs: [corporateServicesV1Pack],
  evaluate: (shape) => ({
    eligible: shape.facts.narrativeSectionCount === 1 && shape.facts.serviceCount > 0 && shape.facts.serviceCount <= 12 && shape.facts.projectCount <= 6,
    reasons: [
      { code: "service_content_available", contribution: shape.facts.serviceCount >= 4 ? 3 : shape.facts.serviceCount > 0 ? 2 : -3, evidenceContentIds: [] },
      { code: "narrative_content_available", contribution: shape.facts.narrativeSectionCount === 1 ? 2 : -3, evidenceContentIds: [] },
      { code: "corporate_detail_content_available", contribution: shape.facts.corporateDetailCount > 0 ? 1 : 0, evidenceContentIds: [] },
      { code: "projects_absent_or_secondary", contribution: shape.facts.projectCount === 0 ? 2 : shape.facts.authenticProjectImageCoverage < 0.75 ? 0 : -2, evidenceContentIds: [] },
    ],
  }),
} as const satisfies AuthoredTemplateFamily;

export const productTechFamily = {
  id: "product-tech",
  label: "Product / Tech",
  priority: 95,
  packs: [productTechV1Pack],
  evaluate: (shape) => ({
    eligible: shape.facts.productTechSignal && shape.facts.narrativeSectionCount === 1 && shape.facts.productFeatureCount > 0 && shape.facts.projectCount === 0,
    reasons: [
      { code: "product_tech_company_type", contribution: shape.facts.productTechSignal ? 3 : -3, evidenceContentIds: [] },
      { code: "product_features_available", contribution: shape.facts.productFeatureCount >= 4 ? 3 : shape.facts.productFeatureCount > 0 ? 2 : -3, evidenceContentIds: [] },
      { code: "product_use_cases_available", contribution: shape.facts.useCaseCount > 0 ? 1 : 0, evidenceContentIds: [] },
      { code: "project_free_product_profile", contribution: shape.facts.projectCount === 0 ? 1 : -2, evidenceContentIds: [] },
    ],
  }),
} as const satisfies AuthoredTemplateFamily;

export const authoredTemplateFamilies = [visualPortfolioFamily, corporateServicesFamily, productTechFamily] as const;

export type RegisteredAuthoredTemplateFamilyId = (typeof authoredTemplateFamilies)[number]["id"];

export const getAuthoredTemplateFamily = (id: RegisteredAuthoredTemplateFamilyId) =>
  authoredTemplateFamilies.find((family) => family.id === id) ?? null;
