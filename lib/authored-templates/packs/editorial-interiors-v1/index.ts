import { jsPDF } from "jspdf";
import type {
  ContractIssue,
  TemplateInstance,
  TemplatePack,
  TemplateRenderAudit,
} from "../../types";
import { editorialInteriorsCapabilitiesTemplate } from "./capabilities";
import { editorialInteriorsCapabilitiesSupportingTemplate } from "./capabilities-supporting";
import type {
  CapabilitiesContent,
  CoverContent,
  EditorialInteriorsV1DocumentInput,
  NarrativeContent,
  ProjectFeatureContent,
} from "./content";
import { editorialInteriorsCoverTemplate } from "./cover";
import { editorialInteriorsNarrativeTemplate, editorialInteriorsSparseNarrativeTemplate, selectEditorialInteriorsNarrativeTemplate } from "./narrative";
import { editorialInteriorsProjectFeatureTemplate } from "./project-feature";
import { editorialInteriorsMultiProjectTemplates } from "./portfolio-project-pages";
import { editorialInteriorsV1VisualSystem } from "./visual-system";
import { authoredCoverTemplates } from "../../cover-library";

export const EDITORIAL_INTERIORS_V1_PAGE_ORDER = [
  editorialInteriorsCoverTemplate.id,
  editorialInteriorsNarrativeTemplate.id,
  editorialInteriorsCapabilitiesTemplate.id,
  editorialInteriorsProjectFeatureTemplate.id,
] as const;

export const editorialInteriorsV1Pack = {
  id: "editorial-interiors-v1",
  version: 1,
  pageOrder: EDITORIAL_INTERIORS_V1_PAGE_ORDER,
  visualSystem: editorialInteriorsV1VisualSystem,
  templates: [
    editorialInteriorsCoverTemplate,
    editorialInteriorsNarrativeTemplate,
    editorialInteriorsCapabilitiesTemplate,
    editorialInteriorsProjectFeatureTemplate,
    editorialInteriorsSparseNarrativeTemplate,
    editorialInteriorsCapabilitiesSupportingTemplate,
    ...editorialInteriorsMultiProjectTemplates,
    ...authoredCoverTemplates,
  ],
} as const satisfies TemplatePack;

export type PreparedEditorialInteriorsV1Document = {
  packId: typeof editorialInteriorsV1Pack.id;
  instances: readonly [
    TemplateInstance<CoverContent>,
    TemplateInstance<NarrativeContent>,
    TemplateInstance<CapabilitiesContent>,
    TemplateInstance<ProjectFeatureContent>,
  ];
  consumedContentIds: readonly string[];
};

export type EditorialInteriorsV1PreparationResult =
  | { compatible: true; document: PreparedEditorialInteriorsV1Document; issues: [] }
  | { compatible: false; document: null; issues: ContractIssue[] };

export const prepareEditorialInteriorsV1Document = (
  input: EditorialInteriorsV1DocumentInput,
): EditorialInteriorsV1PreparationResult => {
  const narrativeTemplate = selectEditorialInteriorsNarrativeTemplate(input.narrative);
  const results = [
    editorialInteriorsCoverTemplate.prepare(input.cover),
    narrativeTemplate.prepare(input.narrative),
    editorialInteriorsCapabilitiesTemplate.prepare(input.capabilities),
    editorialInteriorsProjectFeatureTemplate.prepare(input.projectFeature),
  ] as const;
  const issues = results.flatMap((result) => result.compatible ? [] : result.issues);
  if (issues.length > 0) return { compatible: false, document: null, issues };

  const [coverResult, narrativeResult, capabilitiesResult, projectFeatureResult] = results;
  if (
    !coverResult.compatible ||
    !narrativeResult.compatible ||
    !capabilitiesResult.compatible ||
    !projectFeatureResult.compatible
  ) throw new Error("Compatible authored results became unavailable.");

  const instances = [
    coverResult.instance,
    narrativeResult.instance,
    capabilitiesResult.instance,
    projectFeatureResult.instance,
  ] as const;
  const consumedContentIds = instances.flatMap((instance) => instance.consumedContentIds);
  const seen = new Set<string>();
  const duplicateIssues: ContractIssue[] = [];
  consumedContentIds.forEach((contentId, index) => {
    if (seen.has(contentId)) {
      duplicateIssues.push({
        code: "duplicate_content_consumption",
        path: `pages.${index}.contentId`,
        slotId: instances[index].templateId,
        message: `Content ID ${contentId} is consumed more than once.`,
      });
    }
    seen.add(contentId);
  });
  if (duplicateIssues.length > 0) {
    return { compatible: false, document: null, issues: duplicateIssues };
  }

  return {
    compatible: true,
    document: {
      packId: editorialInteriorsV1Pack.id,
      instances,
      consumedContentIds,
    },
    issues: [],
  };
};

export type EditorialInteriorsV1RenderResult = {
  pdf: jsPDF;
  audits: readonly [TemplateRenderAudit, TemplateRenderAudit, TemplateRenderAudit, TemplateRenderAudit];
};

export const renderPreparedEditorialInteriorsV1Document = (
  prepared: PreparedEditorialInteriorsV1Document,
): EditorialInteriorsV1RenderResult => {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  pdf.setCreationDate(new Date("2000-01-01T00:00:00.000Z"));
  pdf.setFileId("00000000000000000000000000000000");
  const coverAudit = editorialInteriorsCoverTemplate.render(pdf, prepared.instances[0]);
  pdf.addPage("a4", "portrait");
  const narrativeTemplate = selectEditorialInteriorsNarrativeTemplate(prepared.instances[1].source);
  const narrativeAudit = narrativeTemplate.render(pdf, prepared.instances[1]);
  pdf.addPage("a4", "portrait");
  const capabilitiesAudit = editorialInteriorsCapabilitiesTemplate.render(pdf, prepared.instances[2]);
  pdf.addPage("a4", "portrait");
  const projectFeatureAudit = editorialInteriorsProjectFeatureTemplate.render(pdf, prepared.instances[3]);

  return {
    pdf,
    audits: [coverAudit, narrativeAudit, capabilitiesAudit, projectFeatureAudit],
  };
};

export {
  editorialInteriorsCapabilitiesTemplate,
  editorialInteriorsCoverTemplate,
  editorialInteriorsNarrativeTemplate,
  editorialInteriorsSparseNarrativeTemplate,
  editorialInteriorsProjectFeatureTemplate,
  editorialInteriorsV1VisualSystem,
};
export type {
  CapabilitiesContent,
  CoverContent,
  EditorialInteriorsV1DocumentInput,
  NarrativeContent,
  ProjectFeatureContent,
};
