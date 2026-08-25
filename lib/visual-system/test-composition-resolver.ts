import { resolvePageComposition, type ResolvedArea } from "./composition-resolver";
import type {
  PageCompositionArchetype,
  PageCompositionDensity,
  PageCompositionPlan,
  SelectedContextualVisual,
} from "./types";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const selectedVisual: SelectedContextualVisual = {
  role: "contextual_stock",
  provenance: "pexels",
  briefId: "cover_hero",
  purpose: "hero",
  placement: "full_bleed",
  aspectRatio: "16:9",
  status: "selected",
  source: "pexels",
  photographer: "Test Photographer",
  imageUrl: "https://images.example.test/hero.jpg",
  width: 2400,
  height: 1350,
  overallScore: 0.9,
  fallbackReason: null,
};

const archetypes: PageCompositionArchetype[] = [
  "cover_editorial",
  "narrative_split",
  "narrative_stack",
  "project_grid",
  "project_feature",
];
const densities: PageCompositionDensity[] = ["minimal", "balanced", "rich"];

const plan: PageCompositionPlan = {
  version: 2,
  pages: [
    {
      id: "cover",
      pageRole: "cover",
      archetype: "cover_editorial",
      density: "minimal",
      sections: [],
      visualAssignments: [
        { role: "contextual_stock", briefId: "cover_hero", slot: "hero" },
      ],
      hierarchy: { emphasis: "visual" },
    },
    {
      id: "introduction",
      pageRole: "introduction",
      archetype: "narrative_split",
      density: "balanced",
      sections: [{ sectionId: "about", treatment: "lead" }],
      visualAssignments: [
        {
          role: "contextual_stock",
          briefId: "missing_context",
          slot: "side_media",
        },
      ],
      hierarchy: { primarySectionId: "about", emphasis: "balanced" },
    },
    {
      id: "narrative",
      pageRole: "narrative",
      archetype: "narrative_stack",
      density: "rich",
      sections: [{ sectionId: "services", treatment: "body" }],
      visualAssignments: [],
      hierarchy: { primarySectionId: "services", emphasis: "content" },
    },
    {
      id: "project-grid",
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
      hierarchy: { primarySectionId: "projects", emphasis: "content" },
    },
    {
      id: "project-feature",
      pageRole: "projects",
      archetype: "project_feature",
      density: "minimal",
      sections: [
        {
          sectionId: "featuredProjects",
          treatment: "project_feature",
          projectNames: ["Project Two"],
        },
      ],
      visualAssignments: [],
      hierarchy: {
        primarySectionId: "featuredProjects",
        emphasis: "content",
      },
    },
  ],
};

const context = {
  sectionIds: ["about", "services", "projects", "featuredProjects"],
  projectNames: ["Project One", "Project Two"],
  contextualVisuals: [selectedVisual],
};

const first = resolvePageComposition(plan, context);
const second = resolvePageComposition(plan, context);
assert(first.ok && second.ok, "Valid plan should resolve.");
assert(
  JSON.stringify(first) === JSON.stringify(second),
  "The same input must produce identical resolved output."
);

if (!first.ok) {
  throw new Error("Expected resolved composition.");
}

assert(
  first.composition.pages.map((page) => page.archetype).join(",") ===
    archetypes.join(","),
  "All supported archetypes should resolve in order."
);
assert(
  densities.every((density) =>
    first.composition.pages.some((page) => page.density === density)
  ),
  "All density presets should resolve."
);

const isWithinPage = (area: ResolvedArea) =>
  area.x >= 0 &&
  area.y >= 0 &&
  area.width >= 0 &&
  area.height >= 0 &&
  area.x + area.width <= 210 &&
  area.y + area.height <= 297;

first.composition.pages.forEach((page) => {
  [
    page.pageArea,
    page.headerArea,
    page.contentArea,
    page.sectionArea,
    page.footerArea,
    ...page.visualAssignments.flatMap((visual) => [
      visual.area,
      visual.fallbackArea,
    ]),
  ].forEach((area) => {
    assert(isWithinPage(area), `${page.id} contains an out-of-bounds area.`);
  });
});

const missingVisual = first.composition.pages[1].visualAssignments[0];
assert(
  missingVisual.state === "missing" &&
    missingVisual.visual === null &&
    Boolean(missingVisual.fallbackReason),
  "Missing visual should resolve to an explicit safe fallback state."
);
assert(
  first.composition.pages[3].projectImagePolicy ===
    "authentic_project_images_only" &&
    first.composition.pages[4].projectImagePolicy ===
      "authentic_project_images_only",
  "Project pages must retain the authentic-project-image policy."
);

const invalidProjectVisualPlan = structuredClone(plan);
invalidProjectVisualPlan.pages[3].visualAssignments.push({
  role: "contextual_stock",
  briefId: "cover_hero",
  slot: "top_media",
});
const invalidProjectVisual = resolvePageComposition(
  invalidProjectVisualPlan,
  context
);
assert(
  !invalidProjectVisual.ok &&
    invalidProjectVisual.issues.some(
      (issue) => issue.code === "contextual_visual_in_project_page"
    ),
  "Contextual stock must be rejected from project compositions."
);

const unknownSectionPlan = structuredClone(plan);
unknownSectionPlan.pages[1].sections[0].sectionId = "unknown";
const unknownSection = resolvePageComposition(unknownSectionPlan, context);
assert(
  !unknownSection.ok &&
    unknownSection.issues.some((issue) => issue.code === "unknown_section"),
  "Unknown section references should fail safely."
);

console.log("Composition resolver tests passed.");
