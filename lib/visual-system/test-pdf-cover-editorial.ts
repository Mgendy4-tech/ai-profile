import {
  createCoverEditorialLayout,
  drawCoverEditorial,
  getCoverEditorialActivation,
  prepareCoverTypography,
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

const imageLayout = createCoverEditorialLayout(activation!.page, true, hero);
const imageFreeLayout = createCoverEditorialLayout(activation!.page, false);
assert(imageLayout?.mode === "image", "Usable hero should choose image mode.");
assert(
  imageLayout?.variant === "full_bleed_overlay",
  "Wide selected hero should deterministically use full-bleed overlay."
);
assert(
  imageFreeLayout?.mode === "image_free" &&
    imageFreeLayout.variant === "typographic_hero" &&
    imageFreeLayout.heroArea === null &&
    imageFreeLayout.usesPlaceholderPanel === false &&
    imageFreeLayout.usesInsetFrame === false &&
    imageFreeLayout.artDirection.compositionFamily === "cover_typographic",
  "Missing image data should choose an intentional typographic cover."
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
    ...(layout.heroArea ? [layout.heroArea] : []),
    layout.panelArea,
    layout.accentArea,
    layout.logoArea,
    layout.titleArea,
  ].forEach((area) => assert(isWithinPage(area), "Cover area must stay in A4 bounds."));
});

const portraitHero: SelectedContextualVisual = {
  ...hero,
  briefId: "portrait-hero",
  aspectRatio: "1:1",
  width: 1200,
  height: 1400,
};
assert(
  createCoverEditorialLayout(activation!.page, true, portraitHero)?.variant ===
    "asymmetric_split",
  "Non-wide selected imagery should use the asymmetric split variant."
);
assert(
  imageLayout?.heroArea?.x === 0 &&
    imageLayout.heroArea.y === 0 &&
    imageLayout.heroArea.width === 210,
  "Bleed cover imagery should touch the physical top, left, and right edges."
);

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
const coverTypography = prepareCoverTypography(
  pdf,
  imageFreeLayout!,
  "Aurelia Interior Studio",
  designTokens
);
assert(
  Boolean(coverTypography) &&
    coverTypography!.eyebrowBounds.bottom < coverTypography!.ruleY &&
    coverTypography!.ruleY < coverTypography!.titleBounds.top,
  "Cover rule must clear both overline and display glyph bounds."
);
assert(
  imageFreeLayout!.logoArea.height >= 28 &&
    imageFreeLayout!.logoArea.width >= imageFreeLayout!.titleArea.width * 0.45,
  "The image-free cover logo must have a deliberate proportional relationship to the title field."
);
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
