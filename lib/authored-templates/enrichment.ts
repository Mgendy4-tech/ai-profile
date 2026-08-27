import type {
  BrandAnalysis,
  SelectedContextualVisual,
} from "../visual-system/types";
import type {
  AuthoredPageSources,
  ProductionAuthoredAdapterInput,
  ProductionGeneratedSection,
  ProductionProjectVisual,
  SupportedAuthoredPageRole,
} from "./adapter";
import { PRODUCTION_V1_LIMITS } from "../production-limits";

export type AuthoredFieldCategory =
  | "DIRECT"
  | "DETERMINISTICALLY_DERIVED"
  | "OPTIONAL_OMITTABLE"
  | "REQUIRES_UPSTREAM_SEMANTIC_ENRICHMENT"
  | "UNSAFE_POC_ONLY";

/** Auditable production classification; no field is filled by inference. */
export const EDITORIAL_INTERIORS_V1_FIELD_CLASSIFICATION = {
  companyName: "DIRECT",
  companyAbout: "DIRECT",
  companyActivities: "DIRECT",
  companyExperience: "DIRECT",
  sectionIdsTitlesDescriptionsContent: "DIRECT",
  projectIdsNamesDescriptionsImages: "DIRECT",
  generatedItemIds: "DETERMINISTICALLY_DERIVED",
  companyContentId: "DETERMINISTICALLY_DERIVED",
  imageFormatDimensionsAspectRatio: "DETERMINISTICALLY_DERIVED",
  brandAnalysis: "OPTIONAL_OMITTABLE",
  contextualVisuals: "OPTIONAL_OMITTABLE",
  coverTitleWrapping: "DETERMINISTICALLY_DERIVED",
  narrativeCalloutAndSecondBlock: "OPTIONAL_OMITTABLE",
  capabilitySubItems: "OPTIONAL_OMITTABLE",
  projectScopeAndDeliverables: "OPTIONAL_OMITTABLE",
  projectFeatureStructuralMetadata: "OPTIONAL_OMITTABLE",
  fakeKpisAchievementsStatistics: "UNSAFE_POC_ONLY",
  fictionalProjectStatusClaims: "UNSAFE_POC_ONLY",
} as const satisfies Readonly<Record<string, AuthoredFieldCategory>>;

export type PersistedCompanyInput = {
  name: string;
  logoUrl?: string;
  about: string;
  activities: string;
  experience: string;
};

export type GeneratedProfileInput = {
  companyName: string;
  companyType: string;
  sections: readonly {
    id: string;
    title: string;
    description: string;
    content: string;
    items: readonly { name: string; description: string; imageUrl?: string }[];
  }[];
};

export type PersistedProjectInput = {
  id: string;
  name: string;
  category?: string;
  description: string;
  imageUrl: string;
};

export type ProductionEnrichmentInput = {
  company: PersistedCompanyInput;
  profile: GeneratedProfileInput;
  projects: readonly PersistedProjectInput[];
  contextualVisuals?: readonly SelectedContextualVisual[];
  brandAnalysis?: BrandAnalysis | null;
  /** Only fields explicitly supplied by a future upstream schema may enter here. */
  upstreamAuthoredPages?: AuthoredPageSources;
};

export type DecodedImageDimensions = { width: number; height: number };
export type ImageMetadataDecoder = (source: string) => Promise<DecodedImageDimensions>;

export type EnrichmentDiagnosticCode =
  | "image_format_unknown"
  | "image_decode_unavailable"
  | "image_decode_failed"
  | "image_dimensions_invalid"
  | "upstream_semantic_enrichment_required"
  | "authentic_project_image_metadata_missing"
  | "source_content_unavailable"
  | "capability_count_unsupported";

export type EnrichmentDiagnostic = {
  code: EnrichmentDiagnosticCode;
  path: string;
  pageRole: SupportedAuthoredPageRole | null;
  message: string;
};

export type EnrichmentRoleReadiness = {
  pageRole: SupportedAuthoredPageRole;
  status: "candidate_available" | "upstream_enrichment_required" | "image_metadata_unavailable";
};

export type ProductionEnrichmentResult = {
  adapterInput: ProductionAuthoredAdapterInput;
  diagnostics: readonly EnrichmentDiagnostic[];
  roleReadiness: readonly EnrichmentRoleReadiness[];
};

const detectDataUrlFormat = (source: string): ProductionProjectVisual["format"] | null => {
  const match = /^data:([^;,]+)[;,]/i.exec(source);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  if (mime === "image/png") return "PNG";
  if (mime === "image/jpeg" || mime === "image/jpg") return "JPEG";
  return null;
};

export const decodeBrowserImageDimensions: ImageMetadataDecoder = (source) =>
  new Promise((resolve, reject) => {
    if (typeof Image === "undefined") {
      reject(new Error("Browser Image decoding is unavailable."));
      return;
    }
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Image decoding failed."));
    image.src = source;
  });

const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
};

const diagnostic = (
  code: EnrichmentDiagnosticCode,
  path: string,
  pageRole: SupportedAuthoredPageRole | null,
  message: string,
): EnrichmentDiagnostic => ({ code, path, pageRole, message });

const normalizeSections = (profile: GeneratedProfileInput): ProductionGeneratedSection[] =>
  profile.sections.map((section) => ({
    id: section.id,
    title: section.title,
    description: section.description,
    content: section.content,
    items: section.items.map((item, itemIndex) => ({
      id: `${section.id}:item:${itemIndex}`,
      name: item.name,
      description: item.description,
    })),
  }));

export const enrichProductionContentForAuthoredTemplates = async (
  input: ProductionEnrichmentInput,
  decodeDimensions: ImageMetadataDecoder = decodeBrowserImageDimensions,
): Promise<ProductionEnrichmentResult> => {
  const diagnostics: EnrichmentDiagnostic[] = [];
  const projectVisuals: ProductionProjectVisual[] = [];

  for (let index = 0; index < input.projects.length; index += 1) {
    const project = input.projects[index];
    const path = `projects.${index}.imageUrl`;
    if (!project.imageUrl) continue;
    const format = detectDataUrlFormat(project.imageUrl);
    if (!format) {
      diagnostics.push(diagnostic("image_format_unknown", path, null, "Only explicit PNG/JPEG data-URL media types can be normalized without guessing."));
      continue;
    }
    let dimensions: DecodedImageDimensions;
    try {
      dimensions = await decodeDimensions(project.imageUrl);
    } catch (error) {
      diagnostics.push(diagnostic(
        typeof Image === "undefined" && decodeDimensions === decodeBrowserImageDimensions ? "image_decode_unavailable" : "image_decode_failed",
        path,
        null,
        error instanceof Error ? error.message : "Image metadata could not be decoded.",
      ));
      continue;
    }
    if (!Number.isFinite(dimensions.width) || !Number.isFinite(dimensions.height) || dimensions.width <= 0 || dimensions.height <= 0 || dimensions.width > PRODUCTION_V1_LIMITS.imageDimensionPx || dimensions.height > PRODUCTION_V1_LIMITS.imageDimensionPx) {
      diagnostics.push(diagnostic("image_dimensions_invalid", path, null, `Decoded image dimensions must be finite, positive, and no larger than ${PRODUCTION_V1_LIMITS.imageDimensionPx}px per side.`));
      continue;
    }
    projectVisuals.push({
      role: "project_image",
      provenance: "user_upload",
      projectId: project.id,
      imageUrl: project.imageUrl,
      format,
      width: dimensions.width,
      height: dimensions.height,
      aspectRatio: dimensions.width / dimensions.height,
    });
  }

  const normalizedSections = normalizeSections(input.profile);
  const firstVisual = projectVisuals[0];
  const firstVisualProject = firstVisual
    ? input.projects.find((project) => project.id === firstVisual.projectId)
    : undefined;
  const narrativeSection = normalizedSections.find((section) =>
    section.id.toLowerCase().includes("about") && section.content.length > 0,
  );
  const capabilitiesSection = normalizedSections.find((section) => {
    const id = section.id.toLowerCase();
    return id.includes("capabil") || id.includes("service") || id.includes("expertise");
  });
  const derivedPages: AuthoredPageSources = {
    ...(firstVisualProject ? {
      cover: {
        contentId: "company",
        documentLabel: "COMPANY PROFILE",
        companyName: input.company.name,
        heroProjectId: firstVisualProject.id,
      },
      projectFeature: {
        contentId: firstVisualProject.id,
        title: firstVisualProject.name,
        overviewBody: firstVisualProject.description,
        heroProjectId: firstVisualProject.id,
      },
    } : {}),
    ...(narrativeSection ? {
      narrative: {
        contentId: narrativeSection.id,
        title: narrativeSection.title,
        body: narrativeSection.content,
        ...(narrativeSection.items[0] ? {
          secondaryBlock: {
            title: narrativeSection.items[0].name,
            body: narrativeSection.items[0].description,
          },
        } : {}),
      },
    } : {}),
    ...(capabilitiesSection?.items.length === 4 ? {
      capabilities: {
        contentId: capabilitiesSection.id,
        eyebrow: "02 / CAPABILITIES",
        heading: capabilitiesSection.title,
        supportingLine: capabilitiesSection.description,
        capabilities: capabilitiesSection.items.map((item, index) => ({
          index: String(index + 1).padStart(2, "0"),
          title: item.name,
          description: item.description,
          items: [],
        })) as unknown as NonNullable<AuthoredPageSources["capabilities"]>["capabilities"],
      },
    } : {}),
  };
  const authoredPages: AuthoredPageSources = {
    ...derivedPages,
    ...structuredClone(input.upstreamAuthoredPages ?? {}),
  };
  const roles: readonly [SupportedAuthoredPageRole, keyof AuthoredPageSources][] = [
    ["cover", "cover"],
    ["narrative", "narrative"],
    ["capabilities", "capabilities"],
    ["project_feature", "projectFeature"],
  ];
  const roleReadiness = roles.map(([pageRole, key]): EnrichmentRoleReadiness => {
    const source = authoredPages[key];
    if (!source) {
      const code = pageRole === "capabilities" && capabilitiesSection && capabilitiesSection.items.length !== 4
        ? "capability_count_unsupported"
        : "source_content_unavailable";
      diagnostics.push(diagnostic(code, `authoredPages.${key}`, pageRole, `Current production source content cannot construct ${pageRole} for this document.`));
      return { pageRole, status: "upstream_enrichment_required" };
    }
    const heroProjectId = key === "cover"
      ? authoredPages.cover?.heroProjectId
      : key === "projectFeature"
        ? authoredPages.projectFeature?.heroProjectId
        : null;
    if (heroProjectId && !projectVisuals.some((visual) => visual.projectId === heroProjectId)) {
      diagnostics.push(diagnostic("authentic_project_image_metadata_missing", `upstreamAuthoredPages.${key}.heroProjectId`, pageRole, `Verified image metadata is unavailable for project ${heroProjectId}.`));
      return { pageRole, status: "image_metadata_unavailable" };
    }
    return { pageRole, status: "candidate_available" };
  });

  const adapterInput: ProductionAuthoredAdapterInput = {
    company: {
      id: "company",
      name: input.company.name,
      about: input.company.about,
      activities: input.company.activities,
      experience: input.company.experience,
    },
    sections: normalizedSections,
    projects: input.projects.map((project) => ({ id: project.id, name: project.name, description: project.description })),
    projectVisuals,
    contextualVisuals: input.contextualVisuals?.map((visual) => ({ ...visual })),
    brandAnalysis: input.brandAnalysis ? { ...input.brandAnalysis, logoColors: [...input.brandAnalysis.logoColors] } : input.brandAnalysis,
    authoredPages,
  };

  return deepFreeze({ adapterInput, diagnostics, roleReadiness });
};
