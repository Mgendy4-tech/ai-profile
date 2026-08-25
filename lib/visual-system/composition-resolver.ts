import type {
  PageCompositionArchetype,
  PageCompositionDensity,
  PageCompositionHierarchy,
  PageCompositionPlan,
  PageCompositionRole,
  PageCompositionSection,
  PageCompositionVisualAssignment,
  SelectedContextualVisual,
} from "./types";

export type ResolvedArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ResolvedDensityParameters = {
  contentInset: number;
  sectionGap: number;
  spacingMultiplier: number;
};

export type ResolvedSectionReference = PageCompositionSection;

export type ResolvedVisualReference = {
  role: "contextual_stock";
  briefId: string;
  slot: PageCompositionVisualAssignment["slot"];
  area: ResolvedArea;
  fallbackArea: ResolvedArea;
  state: "resolved" | "missing" | "unavailable";
  visual: SelectedContextualVisual | null;
  fallbackReason: string | null;
};

export type ResolvedCompositionPage = {
  id: string;
  pageRole: PageCompositionRole;
  archetype: PageCompositionArchetype;
  density: PageCompositionDensity;
  densityParameters: ResolvedDensityParameters;
  pageArea: ResolvedArea;
  headerArea: ResolvedArea;
  contentArea: ResolvedArea;
  sectionArea: ResolvedArea;
  footerArea: ResolvedArea;
  sections: ResolvedSectionReference[];
  visualAssignments: ResolvedVisualReference[];
  hierarchy: PageCompositionHierarchy;
  projectImagePolicy:
    | "authentic_project_images_only"
    | "not_applicable";
};

export type ResolvedPageComposition = {
  sourceVersion: 2;
  unit: "mm";
  pageSize: {
    width: 210;
    height: 297;
  };
  pages: ResolvedCompositionPage[];
};

export type CompositionResolverContext = {
  sectionIds: readonly string[];
  projectNames: readonly string[];
  contextualVisuals: readonly SelectedContextualVisual[];
};

export type CompositionResolverIssue = {
  code:
    | "unknown_section"
    | "duplicate_section"
    | "unknown_project"
    | "contextual_visual_in_project_page"
    | "invalid_visual_provenance";
  path: string;
  message: string;
};

export type CompositionResolverResult =
  | {
      ok: true;
      composition: ResolvedPageComposition;
      issues: [];
    }
  | {
      ok: false;
      composition: null;
      issues: CompositionResolverIssue[];
    };

const PAGE_AREA: ResolvedArea = {
  x: 0,
  y: 0,
  width: 210,
  height: 297,
};

const HEADER_AREA: ResolvedArea = {
  x: 15,
  y: 4,
  width: 180,
  height: 10,
};

const BASE_CONTENT_AREA: ResolvedArea = {
  x: 15,
  y: 22,
  width: 180,
  height: 259,
};

const FOOTER_AREA: ResolvedArea = {
  x: 15,
  y: 283,
  width: 180,
  height: 6,
};

const DENSITY_PARAMETERS: Record<
  PageCompositionDensity,
  ResolvedDensityParameters
> = {
  minimal: {
    contentInset: 8,
    sectionGap: 10,
    spacingMultiplier: 1.2,
  },
  balanced: {
    contentInset: 4,
    sectionGap: 8,
    spacingMultiplier: 1,
  },
  rich: {
    contentInset: 0,
    sectionGap: 6,
    spacingMultiplier: 0.8,
  },
};

const insetArea = (area: ResolvedArea, inset: number): ResolvedArea => ({
  x: area.x + inset,
  y: area.y + inset,
  width: area.width - inset * 2,
  height: area.height - inset * 2,
});

const getSectionArea = (
  archetype: PageCompositionArchetype,
  contentArea: ResolvedArea,
  gap: number
): ResolvedArea => {
  if (archetype === "cover_editorial") {
    return {
      x: contentArea.x,
      y: contentArea.y,
      width: contentArea.width * 0.44,
      height: contentArea.height,
    };
  }

  if (archetype === "narrative_split") {
    const mediaWidth = contentArea.width * 0.38;

    return {
      x: contentArea.x + mediaWidth + gap,
      y: contentArea.y,
      width: contentArea.width - mediaWidth - gap,
      height: contentArea.height,
    };
  }

  if (archetype === "narrative_stack") {
    const mediaHeight = contentArea.height * 0.34;

    return {
      x: contentArea.x,
      y: contentArea.y + mediaHeight + gap,
      width: contentArea.width,
      height: contentArea.height - mediaHeight - gap,
    };
  }

  return { ...contentArea };
};

const getVisualArea = (
  slot: PageCompositionVisualAssignment["slot"],
  contentArea: ResolvedArea
): ResolvedArea => {
  if (slot === "side_media") {
    return {
      x: contentArea.x,
      y: contentArea.y,
      width: contentArea.width * 0.38,
      height: contentArea.height,
    };
  }

  if (slot === "top_media") {
    return {
      x: contentArea.x,
      y: contentArea.y,
      width: contentArea.width,
      height: contentArea.height * 0.34,
    };
  }

  return { ...contentArea };
};

const isProjectPage = (
  archetype: PageCompositionArchetype,
  sections: readonly PageCompositionSection[]
) => {
  return (
    archetype === "project_grid" ||
    archetype === "project_feature" ||
    sections.some(
      (section) =>
        section.treatment === "project_grid" ||
        section.treatment === "project_feature"
    )
  );
};

export const resolvePageComposition = (
  plan: PageCompositionPlan,
  context: CompositionResolverContext
): CompositionResolverResult => {
  const issues: CompositionResolverIssue[] = [];
  const validSectionIds = new Set(context.sectionIds);
  const validProjectNames = new Set(context.projectNames);
  const visualsByBriefId = new Map(
    context.contextualVisuals.map((visual) => [visual.briefId, visual])
  );
  const assignedSectionIds = new Set<string>();

  const pages = plan.pages.map((page, pageIndex): ResolvedCompositionPage => {
    const densityParameters = DENSITY_PARAMETERS[page.density];
    const contentArea = insetArea(
      BASE_CONTENT_AREA,
      densityParameters.contentInset
    );
    const projectPage = isProjectPage(page.archetype, page.sections);

    page.sections.forEach((section, sectionIndex) => {
      const path = `pages.${pageIndex}.sections.${sectionIndex}`;

      if (!validSectionIds.has(section.sectionId)) {
        issues.push({
          code: "unknown_section",
          path: `${path}.sectionId`,
          message: `Unknown section ID: ${section.sectionId}.`,
        });
      }

      if (assignedSectionIds.has(section.sectionId)) {
        issues.push({
          code: "duplicate_section",
          path: `${path}.sectionId`,
          message: `Section ${section.sectionId} is assigned more than once.`,
        });
      } else {
        assignedSectionIds.add(section.sectionId);
      }

      if (
        section.treatment === "project_grid" ||
        section.treatment === "project_feature"
      ) {
        section.projectNames.forEach((projectName, projectIndex) => {
          if (!validProjectNames.has(projectName)) {
            issues.push({
              code: "unknown_project",
              path: `${path}.projectNames.${projectIndex}`,
              message: `Unknown project name: ${projectName}.`,
            });
          }
        });
      }
    });

    const visualAssignments = page.visualAssignments.map(
      (assignment, assignmentIndex): ResolvedVisualReference => {
        const path = `pages.${pageIndex}.visualAssignments.${assignmentIndex}`;

        if (projectPage) {
          issues.push({
            code: "contextual_visual_in_project_page",
            path,
            message: "Contextual stock cannot be assigned to a project page.",
          });
        }

        const visual = visualsByBriefId.get(assignment.briefId);

        if (
          visual &&
          (visual.role !== "contextual_stock" ||
            visual.provenance !== "pexels")
        ) {
          issues.push({
            code: "invalid_visual_provenance",
            path,
            message: "Resolved contextual visuals must be Pexels stock.",
          });
        }

        const resolved = Boolean(
          visual &&
            visual.role === "contextual_stock" &&
            visual.provenance === "pexels" &&
            visual.status === "selected" &&
            visual.source === "pexels" &&
            visual.imageUrl
        );
        const state: ResolvedVisualReference["state"] = !visual
          ? "missing"
          : resolved
          ? "resolved"
          : "unavailable";

        return {
          role: "contextual_stock",
          briefId: assignment.briefId,
          slot: assignment.slot,
          area: getVisualArea(assignment.slot, contentArea),
          fallbackArea: { ...contentArea },
          state,
          visual: resolved ? visual ?? null : null,
          fallbackReason:
            state === "resolved"
              ? null
              : visual?.fallbackReason ??
                (state === "missing"
                  ? "Assigned contextual visual was not supplied."
                  : "Assigned contextual visual is not available for rendering."),
        };
      }
    );

    return {
      id: page.id,
      pageRole: page.pageRole,
      archetype: page.archetype,
      density: page.density,
      densityParameters: { ...densityParameters },
      pageArea: { ...PAGE_AREA },
      headerArea: { ...HEADER_AREA },
      contentArea,
      sectionArea: getSectionArea(
        page.archetype,
        contentArea,
        densityParameters.sectionGap
      ),
      footerArea: { ...FOOTER_AREA },
      sections: page.sections.map((section) => ({ ...section })),
      visualAssignments,
      hierarchy: { ...page.hierarchy },
      projectImagePolicy: projectPage
        ? "authentic_project_images_only"
        : "not_applicable",
    };
  });

  if (issues.length > 0) {
    return {
      ok: false,
      composition: null,
      issues,
    };
  }

  return {
    ok: true,
    composition: {
      sourceVersion: 2,
      unit: "mm",
      pageSize: {
        width: 210,
        height: 297,
      },
      pages,
    },
    issues: [],
  };
};
