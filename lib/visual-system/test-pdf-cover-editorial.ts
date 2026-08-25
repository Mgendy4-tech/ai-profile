import {
  createCoverEditorialLayout,
  drawCoverEditorial,
  getCoverEditorialActivation,
} from "./pdf-cover-editorial";
import { resolvePageComposition, type ResolvedArea } from "./composition-resolver";
import type { PageCompositionPlan, SelectedContextualVisual } from "./types";
import jsPDF from "jspdf";
import { createPDFDesignTokens } from "./pdf-design-tokens";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const hero: SelectedContextualVisual = {
  role: "contextual_stock",
  provenance: "pexels",
  briefId: "cover-hero",
  purpose: "hero",
  placement: "full_bleed",
  aspectRatio: "16:9",
  status: "selected",
  source: "pexels",
  photographer: "Test Photographer",
  imageUrl: "https://images.example.test/cover.jpg",
  width: 2400,
  height: 1350,
  overallScore: 0.92,
  fallbackReason: null,
};

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
        { role: "contextual_stock", briefId: hero.briefId, slot: "hero" },
      ],
      hierarchy: { emphasis: "visual" },
    },
    {
      id: "about",
      pageRole: "introduction",
      archetype: "narrative_split",
      density: "balanced",
      sections: [{ sectionId: "about", treatment: "lead" }],
      visualAssignments: [],
      hierarchy: { primarySectionId: "about", emphasis: "content" },
    },
  ],
};

const resolve = (visuals: SelectedContextualVisual[]) =>
  resolvePageComposition(plan, {
    sectionIds: ["about"],
    projectNames: [],
    contextualVisuals: visuals,
  });

const withImage = resolve([hero]);
assert(withImage.ok, "A valid cover composition should resolve.");
if (!withImage.ok) throw new Error("Expected resolved cover composition.");

const activation = getCoverEditorialActivation(withImage.composition);
assert(Boolean(activation), "The first cover_editorial page should activate v2.");
assert(
  activation?.heroVisual === hero,
  "Only the resolved contextual-stock hero should be selected."
);

const imageLayout = createCoverEditorialLayout(activation!.page, true);
const imageFreeLayout = createCoverEditorialLayout(activation!.page, false);
assert(imageLayout?.mode === "image", "Usable hero should choose image mode.");
assert(
  imageFreeLayout?.mode === "image_free",
  "Missing image data should choose the deterministic image-free mode."
);
assert(
  imageLayout?.sectionsConsumed.length === 0 &&
    imageFreeLayout?.sectionsConsumed.length === 0,
  "The cover must not consume or duplicate profile sections."
);

const isWithinPage = (area: ResolvedArea) =>
  area.x >= 0 &&
  area.y >= 0 &&
  area.width > 0 &&
  area.height > 0 &&
  area.x + area.width <= 210 &&
  area.y + area.height <= 297;

[imageLayout, imageFreeLayout].forEach((layout) => {
  assert(Boolean(layout), "Cover layout should be safely interpretable.");
  if (!layout) return;
  [
    layout.pageArea,
    layout.heroArea,
    layout.panelArea,
    layout.accentArea,
    layout.logoArea,
    layout.titleArea,
  ].forEach((area) => assert(isWithinPage(area), "Cover area must stay in A4 bounds."));
});

const withoutImage = resolve([]);
assert(withoutImage.ok, "Missing optional hero should still resolve safely.");
if (!withoutImage.ok) throw new Error("Expected image-free cover composition.");
assert(
  getCoverEditorialActivation(withoutImage.composition)?.heroVisual === null,
  "Missing contextual stock must not substitute a project image."
);

const notFirst = structuredClone(withImage.composition);
notFirst.pages.reverse();
assert(
  getCoverEditorialActivation(notFirst) === null,
  "A non-cover first page must preserve the full-v1 fallback decision."
);

const projectFirst = structuredClone(withImage.composition);
projectFirst.pages[0].pageRole = "projects";
projectFirst.pages[0].archetype = "project_feature";
projectFirst.pages[0].projectImagePolicy = "authentic_project_images_only";
assert(
  getCoverEditorialActivation(projectFirst) === null,
  "Project pages must never activate the contextual cover path."
);

const pdf = new jsPDF({ unit: "mm", format: "a4" });
const designTokens = createPDFDesignTokens(null);
const imageFreeResult = drawCoverEditorial({
  pdf,
  page: activation!.page,
  companyName: "Aurelia Interior Studio",
  designTokens,
  heroImageSource: null,
});
assert(
  imageFreeResult.renderedVisual === null &&
    pdf.getNumberOfPages() === 1 &&
    pdf.output("arraybuffer").byteLength > 0,
  "The deterministic image-free cover should render as one valid PDF page."
);

let rejectedUnsafeCover = false;
try {
  drawCoverEditorial({
    pdf: new jsPDF({ unit: "mm", format: "a4" }),
    page: activation!.page,
    companyName: " ",
    designTokens,
    heroImageSource: null,
  });
} catch {
  rejectedUnsafeCover = true;
}
assert(
  rejectedUnsafeCover,
  "Unsafe required cover data must signal the full-v1 fallback path."
);

console.log("PDF editorial cover tests passed.");
