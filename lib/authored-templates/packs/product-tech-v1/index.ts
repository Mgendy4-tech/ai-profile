import type { TemplatePack } from "../../types";
import { productTechCoverTemplate } from "./cover";
import { productFeatureContinuationTemplates, productFeaturePrimaryTemplates } from "./features";
import { productTechOverviewTemplate } from "./overview";
import { productUseCaseContinuationTemplates, productUseCasePrimaryTemplates } from "./use-cases";
import { productTechV1VisualSystem } from "./visual-system";

export const productTechV1Pack = {
  id: "product-tech-v1", version: 1,
  pageOrder: [productTechCoverTemplate.id, productTechOverviewTemplate.id, productFeaturePrimaryTemplates[3].id],
  visualSystem: productTechV1VisualSystem,
  templates: [productTechCoverTemplate, productTechOverviewTemplate, ...productFeaturePrimaryTemplates, ...productFeatureContinuationTemplates, ...productUseCasePrimaryTemplates, ...productUseCaseContinuationTemplates],
} as const satisfies TemplatePack;
export * from "./content";
