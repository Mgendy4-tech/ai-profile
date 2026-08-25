import {
  pageCompositionPlanSchema,
  validatePageCompositionPlanSemantics,
  type PageCompositionSemanticContext,
} from "./page-composition-plan";
import type {
  PageCompositionPlan,
  SelectedContextualVisual,
} from "./types";

export type SanitizedContextualVisual = Pick<
  SelectedContextualVisual,
  | "briefId"
  | "purpose"
  | "placement"
  | "aspectRatio"
  | "status"
  | "role"
  | "provenance"
>;

export type LegacyPdfLayoutBlock =
  | { type: "header" }
  | {
      type: "textSection" | "fullWidthSection" | "twoColumnSection";
      sectionId: string;
    }
  | {
      type: "projectGrid" | "projectFeature";
      sectionId: string;
      projectNames: string[];
    };

export type LegacyPdfLayoutPlan = {
  version: 1;
  blocks: LegacyPdfLayoutBlock[];
  pageCompositionPlan?: PageCompositionPlan;
};

export type PlannerSectionMetadata = {
  id: string;
  itemNames: string[];
};

const PURPOSES = ["hero", "contextual", "supporting"] as const;
const PLACEMENTS = ["full_bleed", "column", "side"] as const;
const ASPECT_RATIOS = ["16:9", "4:3", "1:1"] as const;
const STATUSES = ["selected", "fallback"] as const;

export const sanitizeContextualVisuals = (
  value: unknown
): SanitizedContextualVisual[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== "object") {
      return [];
    }

    const visual = candidate as Record<string, unknown>;

    if (
      typeof visual.briefId !== "string" ||
      !PURPOSES.includes(visual.purpose as (typeof PURPOSES)[number]) ||
      !PLACEMENTS.includes(visual.placement as (typeof PLACEMENTS)[number]) ||
      !ASPECT_RATIOS.includes(
        visual.aspectRatio as (typeof ASPECT_RATIOS)[number]
      ) ||
      !STATUSES.includes(visual.status as (typeof STATUSES)[number]) ||
      visual.role !== "contextual_stock" ||
      visual.provenance !== "pexels"
    ) {
      return [];
    }

    return [
      {
        briefId: visual.briefId,
        purpose: visual.purpose as SanitizedContextualVisual["purpose"],
        placement: visual.placement as SanitizedContextualVisual["placement"],
        aspectRatio:
          visual.aspectRatio as SanitizedContextualVisual["aspectRatio"],
        status: visual.status as SanitizedContextualVisual["status"],
        role: "contextual_stock" as const,
        provenance: "pexels" as const,
      },
    ];
  });
};

export const createLegacyFallbackLayoutPlan = (
  sections: readonly PlannerSectionMetadata[]
): LegacyPdfLayoutPlan => ({
  version: 1,
  blocks: [
    { type: "header" },
    ...sections.map((section): LegacyPdfLayoutBlock =>
      section.id === "projects"
        ? {
            type: "projectGrid",
            sectionId: section.id,
            projectNames: section.itemNames,
          }
        : {
            type: "fullWidthSection",
            sectionId: section.id,
          }
    ),
  ],
});

const createLegacyCompatibilityPlan = (
  plan: PageCompositionPlan,
  sections: readonly PlannerSectionMetadata[]
): LegacyPdfLayoutPlan => {
  const blocks: LegacyPdfLayoutBlock[] = [{ type: "header" }];
  const assignedSectionIds = new Set<string>();

  plan.pages.forEach((page) => {
    page.sections.forEach((section) => {
      assignedSectionIds.add(section.sectionId);

      if (section.treatment === "project_grid") {
        blocks.push({
          type: "projectGrid",
          sectionId: section.sectionId,
          projectNames: section.projectNames.slice(0, 20),
        });
      } else if (section.treatment === "project_feature") {
        blocks.push({
          type: "projectFeature",
          sectionId: section.sectionId,
          projectNames: section.projectNames.slice(0, 5),
        });
      } else {
        blocks.push({
          type:
            page.archetype === "narrative_split"
              ? "twoColumnSection"
              : section.treatment === "lead"
              ? "fullWidthSection"
              : "textSection",
          sectionId: section.sectionId,
        });
      }
    });
  });

  sections.forEach((section) => {
    if (!assignedSectionIds.has(section.id)) {
      blocks.push(
        section.id === "projects"
          ? {
              type: "projectGrid",
              sectionId: section.id,
              projectNames: section.itemNames,
            }
          : {
              type: "fullWidthSection",
              sectionId: section.id,
            }
      );
    }
  });

  return {
    version: 1,
    blocks,
    pageCompositionPlan: plan,
  };
};

export type ResolvePageCompositionResult = {
  layoutPlan: LegacyPdfLayoutPlan;
  usedFallback: boolean;
  semanticIssues: ReturnType<
    typeof validatePageCompositionPlanSemantics
  >["issues"];
};

export const resolvePageCompositionPlanForLegacyRenderer = (
  candidate: unknown,
  context: PageCompositionSemanticContext,
  sections: readonly PlannerSectionMetadata[]
): ResolvePageCompositionResult => {
  const fallbackPlan = createLegacyFallbackLayoutPlan(sections);
  const parsed = pageCompositionPlanSchema.safeParse(candidate);

  if (!parsed.success) {
    return {
      layoutPlan: fallbackPlan,
      usedFallback: true,
      semanticIssues: [],
    };
  }

  const semanticValidation = validatePageCompositionPlanSemantics(
    parsed.data,
    context
  );

  if (!semanticValidation.valid) {
    return {
      layoutPlan: fallbackPlan,
      usedFallback: true,
      semanticIssues: semanticValidation.issues,
    };
  }

  return {
    layoutPlan: createLegacyCompatibilityPlan(parsed.data, sections),
    usedFallback: false,
    semanticIssues: [],
  };
};
