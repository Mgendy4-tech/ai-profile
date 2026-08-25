import { z } from "zod";
import type {
  PageCompositionPlan,
  SelectedContextualVisual,
} from "./types";

const narrativeSectionSchema = z.object({
  sectionId: z.string().min(1).max(100),
  treatment: z.enum(["lead", "body"]),
});

const projectSectionSchema = z.object({
  sectionId: z.string().min(1).max(100),
  treatment: z.enum(["project_grid", "project_feature"]),
  projectNames: z.array(z.string().min(1).max(200)).min(1).max(20),
});

const pageCompositionSectionSchema = z.union([
  narrativeSectionSchema,
  projectSectionSchema,
]);

const visualAssignmentSchema = z.object({
  role: z.literal("contextual_stock"),
  briefId: z.string().min(1).max(100),
  slot: z.enum(["hero", "side_media", "top_media"]),
});

const pageCompositionPageSchema = z.object({
  id: z.string().min(1).max(100),
  pageRole: z.enum(["cover", "introduction", "narrative", "projects"]),
  archetype: z.enum([
    "cover_editorial",
    "narrative_split",
    "narrative_stack",
    "project_grid",
    "project_feature",
  ]),
  density: z.enum(["minimal", "balanced", "rich"]),
  sections: z.array(pageCompositionSectionSchema).max(30),
  visualAssignments: z.array(visualAssignmentSchema).max(5),
  hierarchy: z.object({
    primarySectionId: z.string().min(1).max(100).optional(),
    emphasis: z.enum(["visual", "content", "balanced"]),
  }),
});

export const pageCompositionPlanSchema: z.ZodType<PageCompositionPlan> =
  z.object({
    version: z.literal(2),
    pages: z.array(pageCompositionPageSchema).min(1).max(60),
  });

export type PageCompositionSemanticContext = {
  sectionIds: readonly string[];
  contextualVisuals: readonly Pick<
    SelectedContextualVisual,
    "briefId" | "role" | "provenance"
  >[];
  projectNames: readonly string[];
};

export type PageCompositionSemanticIssue = {
  code:
    | "unknown_section"
    | "duplicate_section"
    | "unknown_contextual_brief"
    | "invalid_contextual_provenance"
    | "contextual_visual_in_project_page"
    | "unknown_project";
  path: string;
  message: string;
};

export type PageCompositionSemanticValidation =
  | { valid: true; issues: [] }
  | { valid: false; issues: PageCompositionSemanticIssue[] };

export const validatePageCompositionPlanSemantics = (
  plan: PageCompositionPlan,
  context: PageCompositionSemanticContext
): PageCompositionSemanticValidation => {
  const issues: PageCompositionSemanticIssue[] = [];
  const validSectionIds = new Set(context.sectionIds);
  const validProjectNames = new Set(context.projectNames);
  const contextualVisualsByBriefId = new Map(
    context.contextualVisuals.map((visual) => [visual.briefId, visual])
  );
  const assignedSectionIds = new Set<string>();

  plan.pages.forEach((page, pageIndex) => {
    const projectPage =
      page.archetype === "project_grid" ||
      page.archetype === "project_feature" ||
      page.sections.some(
        (section) =>
          section.treatment === "project_grid" ||
          section.treatment === "project_feature"
      );

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

    page.visualAssignments.forEach((assignment, assignmentIndex) => {
      const path = `pages.${pageIndex}.visualAssignments.${assignmentIndex}`;
      const visual = contextualVisualsByBriefId.get(assignment.briefId);

      if (!visual) {
        issues.push({
          code: "unknown_contextual_brief",
          path: `${path}.briefId`,
          message: `Unknown contextual brief ID: ${assignment.briefId}.`,
        });
      } else if (
        assignment.role !== "contextual_stock" ||
        visual.role !== "contextual_stock" ||
        visual.provenance !== "pexels"
      ) {
        issues.push({
          code: "invalid_contextual_provenance",
          path,
          message: "Visual assignment must reference contextual Pexels stock.",
        });
      }

      if (projectPage) {
        issues.push({
          code: "contextual_visual_in_project_page",
          path,
          message: "Contextual stock cannot be assigned to a project page.",
        });
      }
    });
  });

  return issues.length === 0
    ? { valid: true, issues: [] }
    : { valid: false, issues };
};
