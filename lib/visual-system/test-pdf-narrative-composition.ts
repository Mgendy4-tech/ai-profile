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
assert(Boolean(preparedSplit), "narrative_split should preflight successfully.");
assert(Boolean(preparedStack), "narrative_stack should preflight successfully.");
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

const imageLayout = createNarrativePageLayout(splitActivation!, true);
const imageFreeLayout = createNarrativePageLayout(stackActivation!, false);
assert(imageLayout?.mode === "image", "Resolved media should use image mode.");
assert(
  imageFreeLayout?.mode === "image_free",
  "Missing media should use deterministic image-free mode."
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
  [layout.pageArea, layout.contentArea, layout.mediaArea, layout.textArea].forEach(
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
