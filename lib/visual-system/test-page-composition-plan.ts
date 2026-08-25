import {
  pageCompositionPlanSchema,
  validatePageCompositionPlanSemantics,
  type PageCompositionSemanticContext,
} from "./page-composition-plan";
import type { PageCompositionPlan } from "./types";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const context: PageCompositionSemanticContext = {
  sectionIds: ["about", "projects"],
  contextualVisuals: [
    {
      briefId: "about_context",
      role: "contextual_stock",
      provenance: "pexels",
    },
  ],
  projectNames: ["Project One"],
};

const validPlan: PageCompositionPlan = {
  version: 2,
  pages: [
    {
      id: "introduction",
      pageRole: "introduction",
      archetype: "narrative_split",
      density: "balanced",
      sections: [{ sectionId: "about", treatment: "lead" }],
      visualAssignments: [
        {
          role: "contextual_stock",
          briefId: "about_context",
          slot: "side_media",
        },
      ],
      hierarchy: {
        primarySectionId: "about",
        emphasis: "balanced",
      },
    },
    {
      id: "projects",
      pageRole: "projects",
      archetype: "project_grid",
      density: "balanced",
      sections: [
        {
          sectionId: "projects",
          treatment: "project_grid",
          projectNames: ["Project One"],
        },
      ],
      visualAssignments: [],
      hierarchy: {
        primarySectionId: "projects",
        emphasis: "content",
      },
    },
  ],
};

const clonePlan = () => structuredClone(validPlan);
const hasIssue = (
  plan: PageCompositionPlan,
  code: string,
  semanticContext = context
) => {
  const result = validatePageCompositionPlanSemantics(plan, semanticContext);
  return !result.valid && result.issues.some((issue) => issue.code === code);
};

assert(
  pageCompositionPlanSchema.safeParse(validPlan).success,
  "Valid version-2 plan should pass runtime schema validation."
);
assert(
  validatePageCompositionPlanSemantics(validPlan, context).valid,
  "Valid narrative contextual assignment should pass semantic validation."
);

const unknownSectionPlan = clonePlan();
unknownSectionPlan.pages[0].sections[0].sectionId = "unknown";
assert(
  hasIssue(unknownSectionPlan, "unknown_section"),
  "Unknown section ID should be rejected."
);

const duplicateSectionPlan = clonePlan();
duplicateSectionPlan.pages[1].sections.push({
  sectionId: "about",
  treatment: "body",
});
assert(
  hasIssue(duplicateSectionPlan, "duplicate_section"),
  "Duplicate section assignment should be rejected."
);

const unknownBriefPlan = clonePlan();
unknownBriefPlan.pages[0].visualAssignments[0].briefId = "unknown_brief";
assert(
  hasIssue(unknownBriefPlan, "unknown_contextual_brief"),
  "Unknown contextual brief ID should be rejected."
);

const projectGridVisualPlan = clonePlan();
projectGridVisualPlan.pages[1].visualAssignments.push({
  role: "contextual_stock",
  briefId: "about_context",
  slot: "top_media",
});
assert(
  hasIssue(projectGridVisualPlan, "contextual_visual_in_project_page"),
  "Contextual stock assigned to project_grid should be rejected."
);

const projectFeatureVisualPlan = clonePlan();
projectFeatureVisualPlan.pages[1].archetype = "project_feature";
projectFeatureVisualPlan.pages[1].sections = [
  {
    sectionId: "projects",
    treatment: "project_feature",
    projectNames: ["Project One"],
  },
];
projectFeatureVisualPlan.pages[1].visualAssignments.push({
  role: "contextual_stock",
  briefId: "about_context",
  slot: "top_media",
});
assert(
  hasIssue(projectFeatureVisualPlan, "contextual_visual_in_project_page"),
  "Contextual stock assigned to project_feature should be rejected."
);

const invalidProjectPlan = clonePlan();
const projectSection = invalidProjectPlan.pages[1].sections[0];
if (
  projectSection.treatment === "project_grid" ||
  projectSection.treatment === "project_feature"
) {
  projectSection.projectNames = ["Unknown Project"];
}
assert(
  hasIssue(invalidProjectPlan, "unknown_project"),
  "Invalid project name should be rejected."
);

console.log("Page composition plan tests passed.");
