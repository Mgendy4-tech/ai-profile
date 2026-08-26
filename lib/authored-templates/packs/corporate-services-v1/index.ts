import type { TemplatePack } from "../../types";
import { corporateServicesCoverTemplate } from "./cover";
import { corporateServicesApproachTemplate } from "./approach";
import { corporateServicesNarrativeDenseTemplate, corporateServicesNarrativeStandardTemplate } from "./narrative";
import { corporateServicesContinuationTemplates, corporateServicesPrimaryTemplates } from "./services";
import { corporateServicesV1VisualSystem } from "./visual-system";

export const corporateServicesV1Pack = {
  id: "corporate-services-v1", version: 1,
  pageOrder: [corporateServicesCoverTemplate.id, corporateServicesNarrativeStandardTemplate.id, corporateServicesPrimaryTemplates[3].id],
  visualSystem: corporateServicesV1VisualSystem,
  templates: [corporateServicesCoverTemplate, corporateServicesNarrativeStandardTemplate, corporateServicesNarrativeDenseTemplate, corporateServicesApproachTemplate, ...corporateServicesPrimaryTemplates, ...corporateServicesContinuationTemplates],
} as const satisfies TemplatePack;

export * from "./content";
export { corporateServicesV1VisualSystem };
