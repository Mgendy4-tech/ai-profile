import type {
  PageCompositionArchetype,
  PageCompositionDensity,
  PageCompositionRole,
} from "./types";
import type { PDFPageMode } from "./pdf-design-tokens";
import { resolvePDFPageMode } from "./pdf-page-pacing";

export type PDFCompositionFamily =
  | "cover_bleed"
  | "cover_split"
  | "cover_typographic"
  | "architectural_split"
  | "typography_manifesto"
  | "structural_interstitial"
  | "editorial_portfolio";

export type PDFArtDirection = {
  compositionFamily: PDFCompositionFamily;
  visualDominance: "image" | "typography" | "balanced";
  typographyEmphasis: "hero" | "section" | "content";
  imageTreatment: "edge_bleed" | "edge_split" | "project_hero" | "none";
  whitespaceStrategy: "image_mass" | "anchored_display" | "asymmetric_grid";
  pageMode: PDFPageMode;
  structuralAnchor: "image_edge" | "accent_edge" | "bottom_rail" | "top_rail";
};

export type PDFArtDirectionInput = {
  pageIndex: number;
  pageRole: PageCompositionRole;
  archetype: PageCompositionArchetype;
  density: PageCompositionDensity;
  sectionCount: number;
  textLength: number;
  hasContextualImage: boolean;
  hasAuthenticProjectImage: boolean;
  imageAspectRatio?: number | null;
  previousFamily: PDFCompositionFamily | null;
  previousMode: PDFPageMode | null;
};

export const resolvePDFArtDirection = (
  input: PDFArtDirectionInput
): PDFArtDirection => {
  const hasImage = input.pageRole === "projects"
    ? input.hasAuthenticProjectImage
    : input.hasContextualImage;
  const pageMode = resolvePDFPageMode({
    pageIndex: input.pageIndex,
    pageRole: input.pageRole,
    density: input.density,
    hasImage,
    previousMode: input.previousMode,
  });

  if (input.pageRole === "cover") {
    const compositionFamily = !input.hasContextualImage
      ? "cover_typographic"
      : (input.imageAspectRatio ?? 0) >= 1.5
      ? "cover_bleed"
      : "cover_split";

    return {
      compositionFamily,
      visualDominance:
        compositionFamily === "cover_typographic" ? "typography" : "image",
      typographyEmphasis: "hero",
      imageTreatment:
        compositionFamily === "cover_bleed"
          ? "edge_bleed"
          : compositionFamily === "cover_split"
          ? "edge_split"
          : "none",
      whitespaceStrategy:
        compositionFamily === "cover_typographic"
          ? "anchored_display"
          : "image_mass",
      pageMode,
      structuralAnchor:
        compositionFamily === "cover_typographic" ? "accent_edge" : "image_edge",
    };
  }

  if (input.pageRole === "projects") {
    return {
      compositionFamily: "editorial_portfolio",
      visualDominance: hasImage ? "image" : "typography",
      typographyEmphasis: hasImage ? "section" : "hero",
      imageTreatment: hasImage ? "project_hero" : "none",
      whitespaceStrategy: hasImage ? "image_mass" : "anchored_display",
      pageMode,
      structuralAnchor: hasImage ? "image_edge" : "bottom_rail",
    };
  }

  if (input.hasContextualImage) {
    return {
      compositionFamily: "architectural_split",
      visualDominance: "image",
      typographyEmphasis: "section",
      imageTreatment: "edge_split",
      whitespaceStrategy: "image_mass",
      pageMode,
      structuralAnchor: "image_edge",
    };
  }

  const sparse = input.sectionCount === 1 && input.textLength <= 700;
  let compositionFamily: PDFCompositionFamily = sparse
    ? "typography_manifesto"
    : "structural_interstitial";

  if (compositionFamily === input.previousFamily) {
    compositionFamily = compositionFamily === "typography_manifesto"
      ? "structural_interstitial"
      : "typography_manifesto";
  }

  return {
    compositionFamily,
    visualDominance: "typography",
    typographyEmphasis: "hero",
    imageTreatment: "none",
    whitespaceStrategy:
      compositionFamily === "typography_manifesto"
        ? "anchored_display"
        : "asymmetric_grid",
    pageMode,
    structuralAnchor:
      compositionFamily === "typography_manifesto" ? "bottom_rail" : "accent_edge",
  };
};

export const hasWhitespaceAnchor = (direction: PDFArtDirection) =>
  direction.visualDominance === "image" ||
  direction.typographyEmphasis === "hero" ||
  direction.structuralAnchor === "accent_edge" ||
  direction.structuralAnchor === "bottom_rail" ||
  direction.structuralAnchor === "top_rail";
