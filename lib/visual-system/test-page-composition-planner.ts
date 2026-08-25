import {
  createLegacyFallbackLayoutPlan,
  resolvePageCompositionPlanForLegacyRenderer,
  sanitizeContextualVisuals,
} from "./page-composition-planner";
import type { PageCompositionPlan } from "./types";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const rawVisual = {
  briefId: "about_context",
  purpose: "contextual",
  placement: "side",
  aspectRatio: "4:3",
  status: "selected",
  role: "contextual_stock",
  provenance: "pexels",
  imageUrl: "https://images.example.test/context.jpg",
  photographer: "Test Photographer",
  width: 2400,
  height: 1800,
  overallScore: 0.9,
  fallbackReason: null,
};

const sanitizedVisuals = sanitizeContextualVisuals([rawVisual]);
assert(sanitizedVisuals.length === 1, "Valid visual should be retained.");
assert(
  !Object.hasOwn(sanitizedVisuals[0], "imageUrl") &&
    !Object.hasOwn(sanitizedVisuals[0], "photographer") &&
    !Object.hasOwn(sanitizedVisuals[0], "width"),
  "Planner visual metadata must not contain image data or attribution details."
);

const sections = [
  { id: "about", itemNames: [] },
  { id: "projects", itemNames: ["Project One"] },
];
const semanticContext = {
  sectionIds: ["about", "projects"],
  contextualVisuals: sanitizedVisuals,
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

const validResult = resolvePageCompositionPlanForLegacyRenderer(
  validPlan,
  semanticContext,
  sections
);
assert(!validResult.usedFallback, "Valid version-2 plan should be accepted.");
assert(
  validResult.layoutPlan.pageCompositionPlan?.version === 2,
  "Successful compatibility response should expose the version-2 plan."
);
assert(
  validResult.layoutPlan.version === 1,
  "Compatibility response must remain readable by the version-1 renderer."
);

const unknownBriefPlan = structuredClone(validPlan);
unknownBriefPlan.pages[0].visualAssignments[0].briefId = "unknown_brief";
const unknownBriefResult = resolvePageCompositionPlanForLegacyRenderer(
  unknownBriefPlan,
  semanticContext,
  sections
);
assert(
  unknownBriefResult.usedFallback &&
    unknownBriefResult.semanticIssues.some(
      (issue) => issue.code === "unknown_contextual_brief"
    ),
  "Unknown brief ID should cause safe fallback."
);

const projectStockPlan = structuredClone(validPlan);
projectStockPlan.pages[1].visualAssignments.push({
  role: "contextual_stock",
  briefId: "about_context",
  slot: "top_media",
});
const projectStockResult = resolvePageCompositionPlanForLegacyRenderer(
  projectStockPlan,
  semanticContext,
  sections
);
assert(
  projectStockResult.usedFallback &&
    projectStockResult.semanticIssues.some(
      (issue) => issue.code === "contextual_visual_in_project_page"
    ),
  "Contextual stock in a project composition should cause safe fallback."
);

const invalidSchemaResult = resolvePageCompositionPlanForLegacyRenderer(
  { version: 2, pages: [] },
  semanticContext,
  sections
);
assert(
  invalidSchemaResult.usedFallback,
  "Schema-invalid plan should cause safe fallback."
);
assert(
  JSON.stringify(invalidSchemaResult.layoutPlan) ===
    JSON.stringify(createLegacyFallbackLayoutPlan(sections)),
  "Fallback should use the deterministic version-1 plan."
);

console.log("Page composition planner integration tests passed.");
