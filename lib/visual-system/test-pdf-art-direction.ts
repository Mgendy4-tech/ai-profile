import {
  hasWhitespaceAnchor,
  resolvePDFArtDirection,
  type PDFArtDirectionInput,
} from "./pdf-art-direction";

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const base: PDFArtDirectionInput = {
  pageIndex: 1,
  pageRole: "narrative",
  archetype: "narrative_split",
  density: "balanced",
  sectionCount: 1,
  textLength: 400,
  hasContextualImage: false,
  hasAuthenticProjectImage: false,
  imageAspectRatio: null,
  previousFamily: null,
  previousMode: "dark",
};

const architectural = resolvePDFArtDirection({
  ...base,
  hasContextualImage: true,
});
const manifesto = resolvePDFArtDirection(base);
const interstitial = resolvePDFArtDirection({
  ...base,
  archetype: "narrative_stack",
  sectionCount: 2,
  textLength: 1200,
});
const portfolio = resolvePDFArtDirection({
  ...base,
  pageRole: "projects",
  archetype: "project_grid",
  hasAuthenticProjectImage: true,
});

assert(
  architectural.compositionFamily === "architectural_split" &&
    architectural.imageTreatment === "edge_split",
  "Image-supported narrative should select Architectural Split."
);
assert(
  manifesto.compositionFamily === "typography_manifesto" &&
    manifesto.typographyEmphasis === "hero",
  "Sparse image-free narrative should select Typography Manifesto."
);
assert(
  interstitial.compositionFamily === "structural_interstitial" &&
    interstitial.structuralAnchor === "accent_edge",
  "Denser image-free narrative should select Structural Interstitial."
);
assert(
  portfolio.compositionFamily === "editorial_portfolio" &&
    portfolio.imageTreatment === "project_hero",
  "Authentic project pages should select Editorial Portfolio."
);

const alternated = resolvePDFArtDirection({
  ...base,
  previousFamily: "typography_manifesto",
});
assert(
  alternated.compositionFamily === "structural_interstitial",
  "Consecutive narrative pages should vary family when another is valid."
);
assert(
  [architectural, manifesto, interstitial, portfolio].every(hasWhitespaceAnchor),
  "Every preferred family must provide a legitimate whitespace anchor."
);
assert(
  JSON.stringify(resolvePDFArtDirection(base)) === JSON.stringify(manifesto),
  "Art-direction decisions must be deterministic for identical input."
);

console.log("PDF art direction tests passed.");
