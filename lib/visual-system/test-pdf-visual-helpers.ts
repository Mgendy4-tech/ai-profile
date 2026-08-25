import {
  calculateAspectFillCrop,
  canUseContextualVisualInBlock,
  selectContextualVisual,
} from "./pdf-visual-helpers";
import type { SelectedContextualVisual } from "./types";

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const landscapeCrop = calculateAspectFillCrop(2400, 1600, 160, 90);
assert(Boolean(landscapeCrop), "Landscape crop should be calculated.");
assert(
  landscapeCrop?.sourceHeight === 1350 && landscapeCrop.sourceY === 125,
  "Landscape source should crop vertically without distortion."
);

const portraitCrop = calculateAspectFillCrop(1200, 1800, 160, 90);
assert(Boolean(portraitCrop), "Portrait crop should be calculated.");
assert(
  portraitCrop?.sourceWidth === 1200 && portraitCrop.sourceHeight === 675,
  "Portrait source should crop vertically to the frame ratio."
);

const hero: SelectedContextualVisual = {
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

const fallback: SelectedContextualVisual = {
  ...hero,
  briefId: "about_context",
  purpose: "contextual",
  status: "fallback",
  source: null,
  photographer: null,
  imageUrl: null,
  width: null,
  height: null,
  overallScore: null,
  fallbackReason: "No candidate accepted.",
};

assert(
  selectContextualVisual([fallback, hero], "hero") === hero,
  "Selected hero should be eligible for the cover."
);
assert(
  selectContextualVisual([fallback, hero], "contextual") === null,
  "Fallback contextual visual should not be eligible."
);
assert(
  !canUseContextualVisualInBlock("projectGrid") &&
    !canUseContextualVisualInBlock("projectFeature"),
  "Contextual stock must never be eligible for project blocks."
);

console.log("PDF visual helper tests passed.");
