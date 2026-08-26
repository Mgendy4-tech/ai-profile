import { jsPDF } from "jspdf";
import { validateDocumentCoverage } from "./coverage";
import { validateAuthoredDocumentPlan } from "./document-plan";
import type { AuthoredDocumentPlan, CoverageIssue, NormalizedContentUnit } from "./library-types";
import { corporateServicesV1Pack } from "./packs/corporate-services-v1";
import type { CorporateApproachContent, CorporateCoverContent, CorporateNarrativeContent, CorporateService, CorporateServicesPageContent } from "./packs/corporate-services-v1/content";
import type { AuthoredPageTemplate, ContractIssue, TemplateInstance, TemplateRenderAudit } from "./types";

export type CorporateServicesPlanningInput = {
  units: readonly NormalizedContentUnit[];
  cover: CorporateCoverContent;
  narrative: CorporateNarrativeContent;
  approach?: CorporateApproachContent;
  servicesHeading: string;
  servicesSupportingLine: string;
  services: readonly CorporateService[];
};

export type CorporateServicesPlanningIssue = CoverageIssue | { code: "service_count_unsupported" | "normalized_service_mismatch" | "project_content_unsupported" | "invalid_document_plan"; path: string; message: string };
export type CorporateServicesPlanResult = { compatible: true; plan: AuthoredDocumentPlan; issues: [] } | { compatible: false; plan: null; issues: readonly CorporateServicesPlanningIssue[] };

export const createCorporateServicesDocumentPlan = (input: CorporateServicesPlanningInput): CorporateServicesPlanResult => {
  if (input.services.length < 1) return { compatible: false, plan: null, issues: [{ code: "service_count_unsupported", path: "services", message: "Corporate / Services requires at least one service." }] };
  if (input.units.some((unit) => unit.kind === "project")) return { compatible: false, plan: null, issues: [{ code: "project_content_unsupported", path: "units", message: "Corporate / Services V1 does not consume project units." }] };
  const normalizedServices = input.units.filter((unit) => unit.kind === "service_capability");
  if (normalizedServices.length !== input.services.length || normalizedServices.some((unit, index) => unit.id !== input.services[index].contentId)) return { compatible: false, plan: null, issues: [{ code: "normalized_service_mismatch", path: "services", message: "Normalized service units must match candidate services exactly in source order." }] };
  const company = input.units.find((unit) => unit.kind === "company_identity");
  const narrative = input.units.find((unit) => unit.kind === "narrative_section");
  const narrativeTemplateId = (narrative?.characterCount ?? 0) <= 900 ? "corporate-services-v1.narrative-standard" : "corporate-services-v1.narrative-dense";
  const pages: AuthoredDocumentPlan["pages"][number][] = [
    { pageId: "cover", templateId: "corporate-services-v1.cover", pageRole: "cover", candidate: input.cover, claims: company ? [{ contentId: company.id, mode: "consume", slotId: "companyName" }] : [] },
    { pageId: "narrative", templateId: narrativeTemplateId, pageRole: "narrative", candidate: input.narrative, claims: narrative ? [{ contentId: narrative.id, mode: "consume", slotId: "body" }] : [] },
  ];
  let offset = 0; let sequence = 0;
  while (offset < input.services.length) {
    const count = Math.min(4, input.services.length - offset);
    const services = input.services.slice(offset, offset + count);
    const candidate: CorporateServicesPageContent = { contentId: `services-page:${sequence}`, heading: input.servicesHeading, supportingLine: input.servicesSupportingLine, services };
    pages.push({ pageId: `services:${sequence}`, templateId: sequence === 0 ? `corporate-services-v1.services-${count}` : `corporate-services-v1.services-continuation-${count}`, pageRole: sequence === 0 ? "capabilities" : "continuation", candidate, claims: services.map((service, index) => ({ contentId: service.contentId, mode: "consume", slotId: `services.${index}` })) });
    offset += count; sequence += 1;
  }
  if (input.approach) pages.push({ pageId: "approach", templateId: "corporate-services-v1.approach", pageRole: "narrative", candidate: input.approach, claims: company ? [{ contentId: company.id, mode: "reference", slotId: "activities" }] : [] });
  const plan: AuthoredDocumentPlan = { familyId: "corporate-services", packId: corporateServicesV1Pack.id, pages };
  const structure = validateAuthoredDocumentPlan(plan, [corporateServicesV1Pack]);
  if (structure.length) return { compatible: false, plan: null, issues: structure.map((issue) => ({ code: "invalid_document_plan", path: issue.path, message: issue.message })) };
  const coverage = validateDocumentCoverage(input.units, plan);
  return coverage.complete ? { compatible: true, plan, issues: [] } : { compatible: false, plan: null, issues: coverage.issues };
};

export type PreparedCorporateServicesPlan = { plan: AuthoredDocumentPlan; instances: readonly TemplateInstance<object>[] };
export const prepareCorporateServicesDocumentPlan = (plan: AuthoredDocumentPlan): { compatible: true; prepared: PreparedCorporateServicesPlan; issues: [] } | { compatible: false; prepared: null; issues: readonly ContractIssue[] } => {
  const instances: TemplateInstance<object>[] = []; const issues: ContractIssue[] = [];
  plan.pages.forEach((page) => {
    const template = corporateServicesV1Pack.templates.find((entry) => entry.id === page.templateId) as AuthoredPageTemplate<object> | undefined;
    if (!template) throw new Error(`Unregistered template ${page.templateId}.`);
    const result = template.prepare(page.candidate); if (result.compatible) instances.push(result.instance); else issues.push(...result.issues);
  });
  return issues.length ? { compatible: false, prepared: null, issues } : { compatible: true, prepared: { plan, instances }, issues: [] };
};

export const renderPreparedCorporateServicesPlan = (prepared: PreparedCorporateServicesPlan): { pdf: jsPDF; audits: readonly TemplateRenderAudit[] } => {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" }); pdf.setCreationDate(new Date("2000-01-01T00:00:00.000Z")); pdf.setFileId("00000000000000000000000000000000");
  const audits: TemplateRenderAudit[] = [];
  prepared.plan.pages.forEach((page, index) => {
    if (index) pdf.addPage("a4", "portrait");
    const template = corporateServicesV1Pack.templates.find((entry) => entry.id === page.templateId) as AuthoredPageTemplate<object> | undefined;
    if (!template) throw new Error(`Unregistered template ${page.templateId}.`);
    audits.push(template.render(pdf, prepared.instances[index]));
  });
  return { pdf, audits };
};
