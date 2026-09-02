import type { ImageSlotValue } from "../../types";

export type CorporateCoverContent = { contentId: string; documentLabel: string; companyName: string; companyType: string; logo?: ImageSlotValue };
export type CorporateNarrativeContent = { contentId: string; title: string; body: string; supportingLine: string };
export type CorporateApproachContent = { contentId: string; heading: string; activities: string; experience: string };
export type CorporateService = { contentId: string; index: string; title: string; description: string };
export type CorporateServicesPageContent = { contentId: string; heading: string; supportingLine: string; services: readonly CorporateService[] };
export type CorporateProject = { contentId: string; name: string; description: string };
export type CorporateProjectsPageContent = { contentId: string; heading: string; supportingLine: string; projects: readonly CorporateProject[] };
export type CorporateClosingContent = { contentId: string; companyName: string; logo?: ImageSlotValue };
