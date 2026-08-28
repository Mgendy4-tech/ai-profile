import type { TemplatePack } from "../../types";
import { corporateServicesCoverTemplate } from "./cover";
import { corporateServicesApproachTemplate } from "./approach";
import { corporateServicesNarrativeDenseTemplate, corporateServicesNarrativeSparseTemplate, corporateServicesNarrativeStandardTemplate } from "./narrative";
import { corporateServicesProjectTemplates } from "./projects";
import { corporateServicesContinuationTemplates, corporateServicesPrimaryTemplates } from "./services";
import { corporateServicesV1VisualSystem } from "./visual-system";
import { authoredCoverTemplates } from "../../cover-library";

export const corporateServicesV1Pack = {
  id: "corporate-services-v1", version: 1,
  pageOrder: [corporateServicesCoverTemplate.id, corporateServicesNarrativeStandardTemplate.id, corporateServicesPrimaryTemplates[3].id],
  visualSystem: corporateServicesV1VisualSystem,
  templates: [corporateServicesCoverTemplate, corporateServicesNarrativeSparseTemplate, corporateServicesNarrativeStandardTemplate, corporateServicesNarrativeDenseTemplate, corporateServicesApproachTemplate, ...corporateServicesPrimaryTemplates, ...corporateServicesContinuationTemplates, ...corporateServicesProjectTemplates, ...authoredCoverTemplates],
} as const satisfies TemplatePack;

export * from "./content";
export { corporateServicesV1VisualSystem };
