import { jsPDF } from "jspdf";
import { validateDocumentCoverage } from "./coverage";
import { validateAuthoredDocumentPlan } from "./document-plan";
import type { AuthoredDocumentPlan, CoverageIssue, NormalizedContentUnit } from "./library-types";
import type { AuthoredPageTemplate, ContractIssue, TemplateInstance, TemplateRenderAudit } from "./types";
import { editorialInteriorsV1Pack } from "./packs/editorial-interiors-v1";
import { selectEditorialInteriorsNarrativeTemplate } from "./packs/editorial-interiors-v1/narrative";
import type { CapabilitiesContent, CapabilitiesSupportingContent, CoverContent, NarrativeContent, ProjectFeatureContent } from "./packs/editorial-interiors-v1/content";
import type { PortfolioProjectContent, PortfolioProjectPageContent } from "./packs/editorial-interiors-v1/portfolio-project-pages";
import type { AuthoredCoverContent, CoverTemplateId } from "./cover-library";

export type VisualPortfolioPlanningInput = {
  units: readonly NormalizedContentUnit[];
  cover: AuthoredCoverContent | CoverContent;
  coverTemplateId?: CoverTemplateId;
  narrative: NarrativeContent;
  capabilities: CapabilitiesContent;
  capabilitiesSupporting?: CapabilitiesSupportingContent;
  details?: readonly NarrativeContent[];
  projects: readonly PortfolioProjectContent[];
};

export type VisualPortfolioPlanningIssue =
  | { code: "project_count_unsupported"; path: "projects"; message: string }
  | { code: "normalized_project_mismatch"; path: "units" | "projects"; message: string }
  | { code: "normalized_detail_mismatch"; path: "units" | "details"; message: string }
  | CoverageIssue
  | { code: "invalid_document_plan"; path: string; message: string };

export type VisualPortfolioPlanResult =
  | { compatible: true; plan: AuthoredDocumentPlan; issues: [] }
  | { compatible: false; plan: null; issues: readonly VisualPortfolioPlanningIssue[] };

const continuationTemplateId = (count: number) => `editorial-interiors-v1.portfolio-continuation-${count}`;
const gridTemplateId = (count: number) => `editorial-interiors-v1.project-grid-${count}`;

export const deriveNextProjectTransitionFromPlan = (
  pages: AuthoredDocumentPlan["pages"],
  fromPageIndex: number,
): CapabilitiesSupportingContent["projectTransition"] => {
  const nextPage = pages.slice(fromPageIndex + 1).find((page) => page.pageRole === "project_feature" || page.pageRole === "project_grid" || (page.pageRole === "continuation" && page.pageId.startsWith("projects:")));
  if (!nextPage) return undefined;
  const candidateProjects: readonly { contentId: string; title: string }[] = nextPage.pageRole === "project_feature"
    ? [{ contentId: (nextPage.candidate as ProjectFeatureContent).contentId, title: (nextPage.candidate as ProjectFeatureContent).title }]
    : (nextPage.candidate as PortfolioProjectPageContent).projects.map((project) => ({ contentId: project.contentId, title: project.name }));
  const byId = new Map(candidateProjects.map((project) => [project.contentId, project]));
  const projects = nextPage.claims.filter((claim) => claim.mode === "consume").map((claim) => byId.get(claim.contentId));
  if (projects.some((project) => !project) || projects.length !== candidateProjects.length) throw new Error(`Project transition source mismatch on ${nextPage.pageId}.`);
  return {
    label: projects.length === 1 ? "NEXT / FEATURED PROJECT" : "NEXT / SELECTED WORK",
    projects: projects as readonly { contentId: string; title: string }[],
  };
};

export const createVisualPortfolioDocumentPlan = (
  input: VisualPortfolioPlanningInput,
): VisualPortfolioPlanResult => {
  if (input.projects.length < 1) {
    return { compatible: false, plan: null, issues: [{ code: "project_count_unsupported", path: "projects", message: "Visual / Portfolio requires at least one project." }] };
  }
  const normalizedProjects = input.units.filter((unit) => unit.kind === "project");
  const sourceIds = input.projects.map((project) => project.contentId);
  if (normalizedProjects.length !== input.projects.length || normalizedProjects.some((unit, index) => unit.id !== sourceIds[index])) {
    return { compatible: false, plan: null, issues: [{ code: "normalized_project_mismatch", path: "projects", message: "Normalized project units must match candidate projects exactly in source order." }] };
  }

  const company = input.units.find((unit) => unit.kind === "company_identity");
  const narrative = input.units.find((unit) => unit.kind === "narrative_section");
  const services = input.units.filter((unit) => unit.kind === "service_capability");
  const normalizedDetails = input.units.filter((unit) => unit.kind === "corporate_expertise" || unit.kind === "corporate_approach" || unit.kind === "corporate_supporting_narrative");
  const details = input.details ?? [];
  if (normalizedDetails.length !== details.length || normalizedDetails.some((unit, index) => unit.id !== details[index]?.contentId)) {
    return { compatible: false, plan: null, issues: [{ code: "normalized_detail_mismatch", path: "units", message: "Normalized detail units must match candidate details exactly in source order." }] };
  }
  const pages: AuthoredDocumentPlan["pages"][number][] = [
    { pageId: "cover", templateId: input.coverTemplateId ?? "editorial-interiors-v1.cover", pageRole: "cover", candidate: input.cover, claims: [
      ...(company ? [{ contentId: company.id, mode: "consume" as const, slotId: "companyName" }] : []),
    ] },
    { pageId: "narrative", templateId: selectEditorialInteriorsNarrativeTemplate(input.narrative).id, pageRole: "narrative", candidate: input.narrative, claims: narrative ? [{ contentId: narrative.id, mode: "consume", slotId: "body" }] : [] },
    { pageId: "capabilities", templateId: "editorial-interiors-v1.capabilities", pageRole: "capabilities", candidate: input.capabilities, claims: services.slice(0, 4).map((service, index) => ({ contentId: service.id, mode: "consume", slotId: `capabilities.${index}` })) },
    ...(input.capabilitiesSupporting ? [{ pageId: "capabilities:supporting", templateId: "editorial-interiors-v1.capabilities-supporting-2", pageRole: "continuation" as const, candidate: input.capabilitiesSupporting, claims: [
      ...services.slice(4, 6).map((service, index) => ({ contentId: service.id, mode: "consume" as const, slotId: `capabilities.${index}` })),
      { contentId: input.capabilitiesSupporting.detail.contentId, mode: "consume" as const, slotId: "detail.body" },
    ] }] : []),
    ...details.slice(input.capabilitiesSupporting ? 1 : 0).map((detail, index) => ({ pageId: `detail:${index}`, templateId: selectEditorialInteriorsNarrativeTemplate(detail).id, pageRole: "narrative" as const, candidate: detail, claims: [{ contentId: detail.contentId, mode: "consume" as const, slotId: "body" }] })),
  ];

  const addProjectPage = (templateId: string, pageRole: "project_feature" | "project_grid" | "continuation", projects: readonly PortfolioProjectContent[], sequence: number) => {
    const candidate: ProjectFeatureContent | PortfolioProjectPageContent = pageRole === "project_feature"
      ? { contentId: projects[0].contentId, title: projects[0].name, hero: projects[0].image, overviewBody: projects[0].description }
      : { contentId: `project-page:${projects.map((project) => project.contentId).join("+")}`, projects };
    pages.push({ pageId: `projects:${sequence}`, templateId, pageRole, candidate, claims: projects.map((project, index) => ({ contentId: project.contentId, mode: "consume", slotId: `projects.${index}` })) });
  };

  if (input.projects.length === 1) {
    addProjectPage("editorial-interiors-v1.project-feature", "project_feature", input.projects, 0);
  } else if (input.projects.length <= 4) {
    addProjectPage(gridTemplateId(input.projects.length), "project_grid", input.projects, 0);
  } else {
    addProjectPage(gridTemplateId(4), "project_grid", input.projects.slice(0, 4), 0);
    let offset = 4;
    let sequence = 1;
    while (offset < input.projects.length) {
      const count = Math.min(4, input.projects.length - offset);
      addProjectPage(continuationTemplateId(count), "continuation", input.projects.slice(offset, offset + count), sequence);
      offset += count;
      sequence += 1;
    }
  }

  const supportingPageIndex = pages.findIndex((page) => page.pageId === "capabilities:supporting");
  if (supportingPageIndex >= 0 && input.capabilitiesSupporting) {
    const projectTransition = deriveNextProjectTransitionFromPlan(pages, supportingPageIndex);
    const supportingPage = pages[supportingPageIndex];
    pages[supportingPageIndex] = {
      ...supportingPage,
      candidate: { ...input.capabilitiesSupporting, ...(projectTransition ? { projectTransition } : {}) },
      claims: [
        ...supportingPage.claims,
        ...(projectTransition?.projects.map((project, index) => ({ contentId: project.contentId, mode: "reference" as const, slotId: `projectTransition.projects.${index}` })) ?? []),
      ],
    };
  }

  const plan: AuthoredDocumentPlan = { familyId: "visual-portfolio", packId: editorialInteriorsV1Pack.id, pages };
  const structureIssues = validateAuthoredDocumentPlan(plan, [editorialInteriorsV1Pack]);
  if (structureIssues.length > 0) return { compatible: false, plan: null, issues: structureIssues.map((issue) => ({ code: "invalid_document_plan", path: issue.path, message: issue.message })) };
  const coverage = validateDocumentCoverage(input.units, plan);
  if (!coverage.complete) return { compatible: false, plan: null, issues: coverage.issues };
  return { compatible: true, plan, issues: [] };
};

export type PreparedVisualPortfolioPlan = { plan: AuthoredDocumentPlan; instances: readonly TemplateInstance<object>[] };
export type PrepareVisualPortfolioResult =
  | { compatible: true; prepared: PreparedVisualPortfolioPlan; issues: [] }
  | { compatible: false; prepared: null; issues: readonly ContractIssue[] };

export const prepareVisualPortfolioDocumentPlan = (plan: AuthoredDocumentPlan): PrepareVisualPortfolioResult => {
  const instances: TemplateInstance<object>[] = [];
  const issues: ContractIssue[] = [];
  plan.pages.forEach((page) => {
    const template = editorialInteriorsV1Pack.templates.find((candidate) => candidate.id === page.templateId) as AuthoredPageTemplate<object> | undefined;
    if (!template) throw new Error(`Unregistered template ${page.templateId}.`);
    const result = template.prepare(page.candidate);
    if (result.compatible) instances.push(result.instance);
    else issues.push(...result.issues);
  });
  return issues.length > 0 ? { compatible: false, prepared: null, issues } : { compatible: true, prepared: { plan, instances }, issues: [] };
};

export const renderPreparedVisualPortfolioPlan = (prepared: PreparedVisualPortfolioPlan): { pdf: jsPDF; audits: readonly TemplateRenderAudit[] } => {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  pdf.setCreationDate(new Date("2000-01-01T00:00:00.000Z"));
  pdf.setFileId("00000000000000000000000000000000");
  const audits: TemplateRenderAudit[] = [];
  prepared.plan.pages.forEach((page, index) => {
    if (index > 0) pdf.addPage("a4", "portrait");
    const template = editorialInteriorsV1Pack.templates.find((candidate) => candidate.id === page.templateId) as AuthoredPageTemplate<object> | undefined;
    if (!template) throw new Error(`Unregistered template ${page.templateId}.`);
    audits.push(template.render(pdf, prepared.instances[index]));
  });
  return { pdf, audits };
};
