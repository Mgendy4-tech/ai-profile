import type {
  BrandAnalysis,
  SelectedContextualVisual,
  UserUploadedProjectVisual,
} from "../visual-system/types";
import type { ContractIssue, ImageSlotValue, PageRole } from "./types";
import {
  editorialInteriorsCapabilitiesTemplate,
  editorialInteriorsCoverTemplate,
  editorialInteriorsNarrativeTemplate,
  editorialInteriorsProjectFeatureTemplate,
} from "./packs/editorial-interiors-v1";
import type {
  CapabilitiesContent,
  CoverContent,
  NarrativeContent,
  ProjectFeatureContent,
} from "./packs/editorial-interiors-v1/content";

export type ProductionCompanyContent = {
  id: string;
  name: string;
  about: string;
  activities: string;
  experience: string;
};

export type ProductionGeneratedItem = {
  id: string;
  name: string;
  description: string;
};

export type ProductionGeneratedSection = {
  id: string;
  title: string;
  description: string;
  content: string;
  items: readonly ProductionGeneratedItem[];
};

export type ProductionProjectContent = {
  id: string;
  name: string;
  description: string;
};

/** Metadata obtained when a persisted user image is decoded at the application boundary. */
export type ProductionProjectVisual = UserUploadedProjectVisual & {
  format: ImageSlotValue["format"];
  width: number;
  height: number;
  aspectRatio: number;
};

export type AuthoredPageSources = {
  cover?: Omit<CoverContent, "hero"> & { heroProjectId: string };
  narrative?: NarrativeContent;
  capabilities?: CapabilitiesContent;
  projectFeature?: Omit<ProjectFeatureContent, "hero"> & { heroProjectId: string };
};

/**
 * Thin Phase-C bridge. Phase C.6 permits truthful minimum candidates and keeps
 * optional authored semantics explicit. The adapter never invents absent values.
 */
export type ProductionAuthoredAdapterInput = {
  company: ProductionCompanyContent;
  sections: readonly ProductionGeneratedSection[];
  projects: readonly ProductionProjectContent[];
  projectVisuals: readonly ProductionProjectVisual[];
  contextualVisuals?: readonly SelectedContextualVisual[];
  brandAnalysis?: BrandAnalysis | null;
  authoredPages: AuthoredPageSources;
};

export type MappingIssueCode =
  | "duplicate_source_id"
  | "authored_page_source_missing"
  | "source_content_id_unknown"
  | "capability_count_unsupported"
  | "authentic_project_image_missing"
  | "project_visual_project_unknown"
  | "project_visual_role_invalid"
  | "project_visual_provenance_invalid";

export type MappingIssue = {
  code: MappingIssueCode;
  path: string;
  pageRole: SupportedAuthoredPageRole | null;
  message: string;
};

export type SupportedAuthoredPageRole = Extract<
  PageRole,
  "cover" | "narrative" | "capabilities" | "project_feature"
>;

type PageContentByRole = {
  cover: CoverContent;
  narrative: NarrativeContent;
  capabilities: CapabilitiesContent;
  project_feature: ProjectFeatureContent;
};

export type AuthoredPageReadiness<R extends SupportedAuthoredPageRole = SupportedAuthoredPageRole> =
  | { pageRole: R; status: "ready"; candidate: PageContentByRole[R]; mappingIssues: []; compatibilityIssues: [] }
  | { pageRole: R; status: "mapping_failure"; candidate: null; mappingIssues: MappingIssue[]; compatibilityIssues: [] }
  | { pageRole: R; status: "compatibility_failure"; candidate: PageContentByRole[R]; mappingIssues: []; compatibilityIssues: ContractIssue[] };

export type ProductionAuthoredAdapterResult = {
  packId: "editorial-interiors-v1";
  pages: {
    cover: AuthoredPageReadiness<"cover">;
    narrative: AuthoredPageReadiness<"narrative">;
    capabilities: AuthoredPageReadiness<"capabilities">;
    projectFeature: AuthoredPageReadiness<"project_feature">;
  };
  mappingIssues: readonly MappingIssue[];
  readyPageRoles: readonly SupportedAuthoredPageRole[];
};

const mappingIssue = (
  code: MappingIssueCode,
  path: string,
  pageRole: SupportedAuthoredPageRole | null,
  message: string,
): MappingIssue => ({ code, path, pageRole, message });

const imageForProject = (
  input: ProductionAuthoredAdapterInput,
  projectId: string,
  pageRole: "cover" | "project_feature",
  path: string,
): { image: ImageSlotValue | null; issues: MappingIssue[] } => {
  const visual = input.projectVisuals.find((item) => item.projectId === projectId);
  if (!visual) return { image: null, issues: [mappingIssue("authentic_project_image_missing", path, pageRole, `No authentic user-uploaded project image exists for project ${projectId}.`)] };
  const issues: MappingIssue[] = [];
  if (visual.role !== "project_image") issues.push(mappingIssue("project_visual_role_invalid", `${path}.role`, pageRole, "An authored project image must retain the project_image role."));
  if (visual.provenance !== "user_upload") issues.push(mappingIssue("project_visual_provenance_invalid", `${path}.provenance`, pageRole, "An authentic project image must retain user_upload provenance."));
  if (!input.projects.some((project) => project.id === projectId)) issues.push(mappingIssue("project_visual_project_unknown", `${path}.projectId`, pageRole, `Project ${projectId} does not exist in the production project collection.`));
  if (issues.length) return { image: null, issues };
  return {
    image: {
      role: visual.role,
      provenance: visual.provenance,
      format: visual.format,
      width: visual.width,
      height: visual.height,
      source: visual.imageUrl,
    },
    issues: [],
  };
};

const knownContentIds = (input: ProductionAuthoredAdapterInput) => new Set([
  input.company.id,
  ...input.sections.map((section) => section.id),
  ...input.sections.flatMap((section) => section.items.map((item) => item.id)),
  ...input.projects.map((project) => project.id),
]);

const duplicateIdIssues = (input: ProductionAuthoredAdapterInput): MappingIssue[] => {
  const entries = [
    ["company.id", input.company.id] as const,
    ...input.sections.flatMap((section, sectionIndex) => [
      [`sections.${sectionIndex}.id`, section.id] as const,
      ...section.items.map((item, itemIndex) => [`sections.${sectionIndex}.items.${itemIndex}.id`, item.id] as const),
    ]),
    ...input.projects.map((project, index) => [`projects.${index}.id`, project.id] as const),
  ];
  const seen = new Set<string>();
  return entries.flatMap(([path, id]) => {
    if (seen.has(id)) return [mappingIssue("duplicate_source_id", path, null, `Source/content ID ${id} is duplicated.`)];
    seen.add(id);
    return [];
  });
};

const preflight = <R extends SupportedAuthoredPageRole>(
  pageRole: R,
  candidate: PageContentByRole[R],
): AuthoredPageReadiness<R> => {
  const result = pageRole === "cover"
    ? editorialInteriorsCoverTemplate.prepare(candidate as CoverContent)
    : pageRole === "narrative"
      ? editorialInteriorsNarrativeTemplate.prepare(candidate as NarrativeContent)
      : pageRole === "capabilities"
        ? editorialInteriorsCapabilitiesTemplate.prepare(candidate as CapabilitiesContent)
        : editorialInteriorsProjectFeatureTemplate.prepare(candidate as ProjectFeatureContent);
  return result.compatible
    ? { pageRole, status: "ready", candidate, mappingIssues: [], compatibilityIssues: [] }
    : { pageRole, status: "compatibility_failure", candidate, mappingIssues: [], compatibilityIssues: result.issues };
};

export const adaptProductionContentToEditorialInteriorsV1 = (
  input: ProductionAuthoredAdapterInput,
): ProductionAuthoredAdapterResult => {
  const globalIssues = duplicateIdIssues(input);
  const knownIds = knownContentIds(input);

  const missing = <R extends SupportedAuthoredPageRole>(pageRole: R, path: string): AuthoredPageReadiness<R> => ({
    pageRole,
    status: "mapping_failure",
    candidate: null,
    mappingIssues: [mappingIssue("authored_page_source_missing", path, pageRole, `No authored semantic source was supplied for ${pageRole}.`)],
    compatibilityIssues: [],
  });
  const validateContentId = <R extends SupportedAuthoredPageRole>(pageRole: R, path: string, contentId: string): MappingIssue[] =>
    knownIds.has(contentId) ? [] : [mappingIssue("source_content_id_unknown", path, pageRole, `Content ID ${contentId} does not identify production source content.`)];

  let cover: AuthoredPageReadiness<"cover">;
  const coverSource = input.authoredPages.cover;
  if (!coverSource) cover = missing("cover", "authoredPages.cover");
  else {
    const resolved = imageForProject(input, coverSource.heroProjectId, "cover", "authoredPages.cover.heroProjectId");
    const issues = [...validateContentId("cover", "authoredPages.cover.contentId", coverSource.contentId), ...resolved.issues];
    cover = issues.length || !resolved.image
      ? { pageRole: "cover", status: "mapping_failure", candidate: null, mappingIssues: issues, compatibilityIssues: [] }
      : preflight("cover", { ...coverSource, hero: resolved.image });
  }

  const narrativeSource = input.authoredPages.narrative;
  const narrativeIssues = narrativeSource ? validateContentId("narrative", "authoredPages.narrative.contentId", narrativeSource.contentId) : [];
  const narrative: AuthoredPageReadiness<"narrative"> = !narrativeSource
    ? missing("narrative", "authoredPages.narrative")
    : narrativeIssues.length
      ? { pageRole: "narrative", status: "mapping_failure", candidate: null, mappingIssues: narrativeIssues, compatibilityIssues: [] }
      : preflight("narrative", narrativeSource);

  const capabilitiesSource = input.authoredPages.capabilities;
  const capabilitiesIssues = capabilitiesSource ? validateContentId("capabilities", "authoredPages.capabilities.contentId", capabilitiesSource.contentId) : [];
  if (capabilitiesSource && capabilitiesSource.capabilities.length !== 4) {
    capabilitiesIssues.push(mappingIssue("capability_count_unsupported", "authoredPages.capabilities.capabilities", "capabilities", `The authored composition requires exactly four capability groups; received ${capabilitiesSource.capabilities.length}.`));
  }
  const capabilities: AuthoredPageReadiness<"capabilities"> = !capabilitiesSource
    ? missing("capabilities", "authoredPages.capabilities")
    : capabilitiesIssues.length
      ? { pageRole: "capabilities", status: "mapping_failure", candidate: null, mappingIssues: capabilitiesIssues, compatibilityIssues: [] }
      : preflight("capabilities", capabilitiesSource);

  let projectFeature: AuthoredPageReadiness<"project_feature">;
  const projectSource = input.authoredPages.projectFeature;
  if (!projectSource) projectFeature = missing("project_feature", "authoredPages.projectFeature");
  else {
    const resolved = imageForProject(input, projectSource.heroProjectId, "project_feature", "authoredPages.projectFeature.heroProjectId");
    const issues = [...validateContentId("project_feature", "authoredPages.projectFeature.contentId", projectSource.contentId), ...resolved.issues];
    projectFeature = issues.length || !resolved.image
      ? { pageRole: "project_feature", status: "mapping_failure", candidate: null, mappingIssues: issues, compatibilityIssues: [] }
      : preflight("project_feature", { ...projectSource, hero: resolved.image });
  }

  const pages = { cover, narrative, capabilities, projectFeature };
  const pageValues = [cover, narrative, capabilities, projectFeature] as const;
  const mappingIssues = [...globalIssues, ...pageValues.flatMap((page) => page.mappingIssues)];
  return {
    packId: "editorial-interiors-v1",
    pages,
    mappingIssues,
    readyPageRoles: pageValues.filter((page) => page.status === "ready").map((page) => page.pageRole),
  };
};
