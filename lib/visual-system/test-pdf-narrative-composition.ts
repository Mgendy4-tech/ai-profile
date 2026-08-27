import jsPDF from "jspdf";
import { resolvePageComposition, type ResolvedArea } from "./composition-resolver";
import {
  createNarrativePageLayout,
  drawNarrativePage,
  getNarrativePageActivation,
  prepareNarrativePage,
  type NarrativeContentSection,
} from "./pdf-narrative-composition";
import type { PageCompositionPlan, SelectedContextualVisual } from "./types";
import { createPDFDesignTokens } from "./pdf-design-tokens";

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const contextualVisual: SelectedContextualVisual = {
  role: "contextual_stock",
  provenance: "pexels",
  briefId: "about-side",
  purpose: "contextual",
  placement: "side",
  aspectRatio: "4:3",
  status: "selected",
  source: "pexels",
  photographer: "Test Photographer",
  imageUrl: "https://images.example.test/about.jpg",
  width: 1600,
  height: 1200,
  overallScore: 0.91,
  fallbackReason: null,
};

const plan: PageCompositionPlan = {
  version: 2,
  pages: [
    {
      id: "split",
      pageRole: "introduction",
      archetype: "narrative_split",
      density: "minimal",
      sections: [{ sectionId: "about", treatment: "lead" }],
      visualAssignments: [
        {
          role: "contextual_stock",
          briefId: contextualVisual.briefId,
          slot: "side_media",
        },
      ],
      hierarchy: { primarySectionId: "about", emphasis: "balanced" },
    },
    {
      id: "stack",
      pageRole: "narrative",
      archetype: "narrative_stack",
      density: "rich",
      sections: [
        { sectionId: "services", treatment: "lead" },
        { sectionId: "experience", treatment: "body" },
      ],
      visualAssignments: [],
      hierarchy: { primarySectionId: "services", emphasis: "content" },
    },
  ],
};

const resolved = resolvePageComposition(plan, {
  sectionIds: ["about", "services", "experience"],
  projectNames: [],
  contextualVisuals: [contextualVisual],
});
assert(resolved.ok, "Narrative plan should resolve.");
if (!resolved.ok) throw new Error("Expected resolved narrative plan.");

const splitActivation = getNarrativePageActivation(resolved.composition.pages[0]);
const stackActivation = getNarrativePageActivation(resolved.composition.pages[1]);
assert(
  splitActivation?.expectedVisualSlot === "side_media" &&
    splitActivation.visual === contextualVisual,
  "narrative_split should accept only its resolved contextual side visual."
);
assert(
  stackActivation?.expectedVisualSlot === "top_media" &&
    stackActivation.visual === null,
  "narrative_stack should select top-media geometry and allow image-free state."
);

const content: NarrativeContentSection[] = [
  {
    id: "about",
    title: "About Aurelia",
    content: "A considered interior studio creating refined residential spaces.",
    items: [],
  },
  {
    id: "services",
    title: "Services",
    content: "Interior architecture, space planning, and material direction.",
    items: [
      {
        name: "Interior Architecture",
        description: "Spatial planning shaped around how clients live.",
      },
    ],
  },
  {
    id: "experience",
    title: "Experience",
    content: "A disciplined process from concept through final installation.",
    items: [],
  },
];
const pdf = new jsPDF({ unit: "mm", format: "a4" });
const designTokens = createPDFDesignTokens(null);
const preparedSplit = prepareNarrativePage(
  pdf,
  splitActivation!,
  content,
  true,
  designTokens
);
const preparedStack = prepareNarrativePage(
  pdf,
  stackActivation!,
  content,
  false,
  designTokens
);
const preparedSparse = prepareNarrativePage(
  new jsPDF({ unit: "mm", format: "a4" }),
  splitActivation!,
  content,
  false,
  designTokens
);
const collisionPage = structuredClone(resolved.composition.pages[0]);
collisionPage.sections = [
  { sectionId: "spaces", treatment: "lead" },
  { sectionId: "approach", treatment: "body" },
];
collisionPage.hierarchy.primarySectionId = "spaces";
collisionPage.visualAssignments = [];
const collisionActivation = getNarrativePageActivation(collisionPage);
const collisionPrepared = prepareNarrativePage(
  new jsPDF({ unit: "mm", format: "a4" }),
  collisionActivation!,
  [
    {
      id: "spaces",
      title: "Spaces We Design",
      content:
        "We create carefully considered residential interiors, hospitality spaces, and environments that connect material character with everyday use. Each space is planned around proportion, movement, light, and the practical rhythms of the people who inhabit it.",
      items: [],
    },
    {
      id: "approach",
      title: "The Aurelia Approach",
      content:
        "Our approach brings research, spatial planning, material direction, and detailed coordination into one coherent process. Every decision is tested against the original brief so the finished interior remains calm, useful, and distinctly connected to its setting.",
      items: [],
    },
  ],
  false,
  designTokens
);
assert(Boolean(preparedSplit), "narrative_split should preflight successfully.");
assert(Boolean(collisionPrepared), "The Aurelia two-section typography page must preflight safely.");
assert(
  collisionPrepared!.sections[0].bottom + 5 <=
    collisionPrepared!.sections[1].headingBounds.top,
  "The second display heading must clear the preceding body block."
);
for (let index = 1; index < collisionPrepared!.sections.length; index += 1) {
  assert(
    collisionPrepared!.sections[index - 1].bottom <
      collisionPrepared!.sections[index].headingBounds.top,
    "Every rendered text block must have positive clearance from the next block."
  );
}
const collisionSpan =
  collisionPrepared!.sections.at(-1)!.bottom -
  collisionPrepared!.sections[0].headingBounds.top;
assert(
  collisionSpan >= collisionPrepared!.layout.textArea.height * 0.55,
  "A sparse two-section typography page must use an intentional share of A4 height."
);
assert(
  collisionPrepared!.sections.every(
    (section) => section.headingBounds.top >= 0 && section.bottom <= 297
  ),
  "The corrected multi-section composition must remain inside A4."
);
assert(Boolean(preparedStack), "narrative_stack should preflight successfully.");
assert(
  preparedSplit!.sections.every((section) => section.contentFontSize >= 9.5) &&
    preparedStack!.sections.every((section) => section.contentFontSize >= 9.5),
  "Narrative body type must remain at or above the approved minimum."
);
assert(
  preparedSplit!.sections[0].titleY > preparedSplit!.layout.textArea.y + 35,
  "Image-led narrative text must be optically anchored as a measured group."
);
assert(
  preparedSplit?.consumedSectionIds.join(",") === "about" &&
    preparedStack?.consumedSectionIds.join(",") === "services,experience",
  "Each resolved page must retain its own deterministic section boundary."
);
assert(
  preparedStack?.sections[0].emphasized === true &&
    preparedStack.sections[0].titleFontSize > preparedStack.sections[1].titleFontSize,
  "Lead hierarchy must be visibly stronger than body treatment."
);
assert(
  preparedStack?.sections[0].items.length === 1,
  "Structured narrative items must be preserved before a section is consumed."
);
assert(
  Boolean(preparedSparse) &&
    preparedSparse!.layout.mediaArea === null &&
    preparedSparse!.sections[0].titleY >
      preparedSparse!.layout.textArea.y + 45,
  "Sparse one-section fallback should occupy an intentional vertical editorial zone."
);
assert(
  Boolean(preparedStack) &&
    preparedStack!.sections[0].titleY > preparedStack!.layout.textArea.y + 30 &&
    preparedStack!.sections[1].titleY > preparedStack!.sections[0].titleY,
  "Two-section fallback should establish a deliberate staggered relationship."
);
assert(
  preparedSparse?.sections[0].contentLines.join(" ") === content[0].content,
  "Narrative utilization must preserve every word without invention."
);
[
  ...(preparedSparse?.sections ?? []),
  ...(preparedStack?.sections ?? []),
].forEach((section) => {
  assert(
    section.headingBounds.bottom < section.ruleY,
    "Narrative rule must clear the heading glyph bounds."
  );
  if (section.bodyBounds) {
    assert(
      section.ruleY < section.bodyBounds.top,
      "Narrative rule must clear body glyph bounds."
    );
  }
  assert(
    section.headingBounds.top >= 0 && section.bottom <= 297,
    "Narrative text bounds must remain inside the physical A4 page."
  );
});
assert(
  preparedSparse?.layout.artDirection.compositionFamily ===
    "typography_manifesto" &&
    preparedStack?.layout.artDirection.compositionFamily ===
      "structural_interstitial",
  "Image-free content amount should select manifesto and interstitial families."
);

const imageLayout = createNarrativePageLayout(splitActivation!, true);
const imageFreeLayout = createNarrativePageLayout(stackActivation!, false);
assert(
  imageLayout?.mode === "image" && imageLayout.variant === "media_left",
  "Resolved split media should use its deterministic left variant."
);
assert(
  imageFreeLayout?.mode === "image_free" &&
    imageFreeLayout.variant === "text_dual_column_or_stacked" &&
    imageFreeLayout.mediaArea === null &&
    imageFreeLayout.usesPlaceholderPanel === false,
  "Missing stack media should use an intentional text composition."
);
const splitRight = createNarrativePageLayout(
  splitActivation!,
  true,
  2,
  "media_left",
  "light"
);
assert(
  splitRight?.variant === "media_right" &&
    Boolean(splitRight.mediaArea) &&
    splitRight.textArea.x < splitRight.mediaArea!.x,
  "Consecutive split pages should alternate media from left to right."
);
assert(
  imageLayout?.artDirection.compositionFamily === "architectural_split" &&
    imageLayout.mediaArea?.x === 0 &&
    imageLayout.mediaArea.y === 0 &&
    imageLayout.mediaArea.height === 297,
  "Architectural Split media should own a physical A4 edge."
);

const isWithinA4 = (area: ResolvedArea) =>
  area.x >= 0 &&
  area.y >= 0 &&
  area.width > 0 &&
  area.height > 0 &&
  area.x + area.width <= 210 &&
  area.y + area.height <= 297;
[imageLayout, imageFreeLayout].forEach((layout) => {
  assert(Boolean(layout), "Resolved narrative layout should be valid.");
  if (!layout) return;
  [
    layout.pageArea,
    layout.contentArea,
    ...(layout.mediaArea ? [layout.mediaArea] : []),
    layout.textArea,
  ].forEach(
    (area) => assert(isWithinA4(area), "Narrative geometry must stay within A4.")
  );
});

const drawPdf = new jsPDF({ unit: "mm", format: "a4" });
const drawResult = drawNarrativePage({
  pdf: drawPdf,
  prepared: preparedStack!,
  companyName: "Aurelia Interior Studio",
  designTokens,
  imageSource: null,
});
assert(
  drawResult.renderedVisual === null &&
    drawResult.consumedSectionIds.join(",") === "services,experience",
  "Image-free drawing must not substitute a project or unrelated visual."
);

const consumed = new Set([
  ...(preparedSplit?.consumedSectionIds ?? []),
  ...(preparedStack?.consumedSectionIds ?? []),
]);
assert(
  content.filter((section) => !consumed.has(section.id)).length === 0,
  "Successfully consumed v2 sections must be excluded from legacy rendering."
);

const overflowing = prepareNarrativePage(
  new jsPDF({ unit: "mm", format: "a4" }),
  splitActivation!,
  [{
    id: "about",
    title: "About",
    content: "Long editorial copy ".repeat(1200),
    items: [],
  }],
  false,
  designTokens
);
assert(
  overflowing === null,
  "Unrenderable content must fail preflight before consuming its section."
);

const projectPage = structuredClone(resolved.composition.pages[0]);
projectPage.archetype = "project_feature";
projectPage.pageRole = "projects";
projectPage.projectImagePolicy = "authentic_project_images_only";
assert(
  getNarrativePageActivation(projectPage) === null,
  "Project pages and project-image paths must not activate narrative stock."
);

const invalidProvenance = resolvePageComposition(plan, {
  sectionIds: ["about", "services", "experience"],
  projectNames: [],
  contextualVisuals: [{
    ...contextualVisual,
    provenance: "user_upload",
  } as unknown as SelectedContextualVisual],
});
assert(
  !invalidProvenance.ok &&
    invalidProvenance.issues.some(
      (issue) => issue.code === "invalid_visual_provenance"
    ),
  "Invalid contextual provenance must fail before narrative rendering."
);

console.log("PDF narrative composition tests passed.");
