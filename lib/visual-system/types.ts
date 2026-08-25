export type BrandAnalysis = {
  logoColors: string[];

  colorStrategy:
    | "respect_logo"
    | "expand_palette"
    | "symbolic_override";

  interpretedMood:
    | "warm"
    | "cool"
    | "neutral";

  designStyle:
    | "minimal"
    | "corporate"
    | "creative";

  energyLevel: number;

  confidence: number;
};
export type VisualDirection = {
  concept: string;

  density:
    | "minimal"
    | "balanced"
    | "rich";

  imageBriefs: {
    id: string;

    purpose:
      | "hero"
      | "contextual"
      | "supporting";

    subject: string;

    placement:
      | "full_bleed"
      | "column"
      | "side";

    aspectRatio:
      | "16:9"
      | "4:3"
      | "1:1";

    moodKeywords: string[];
  }[];

  elementCount: {
    geometricShapes: number;
    patterns: number;
    images: number;
    typographyStyles: number;
    accentElements: number;
  };

  animationAllowed: false;
};
export type RankedImage = {
  candidateId: string;
  url: string;

  source:
    | "unsplash"
    | "pexels";

  photographer: string;

  scores: {
  relevance: number;
  composition: number;
  textSafety: number;
  resolution: number;
  orientationFit: number;
};

  overallScore: number;

  recommendation:
    | "accept"
    | "review"
    | "reject";
};
export type PdfVisualPlan = {
  profileId: string;

  coverImage?: RankedImage;

  colorPalette: string[];

  typography: {
    primary: string;
    secondary: string;
  };

  layoutTemplate:
    | "full_bleed"
    | "split_editorial"
    | "top_image_text";

  elementPlan: {
    coverStyle: string;
    useProjectImages: boolean;
    contextualImageCount: number;
  };

  fallbackBehavior:
    | "branded_typography"
    | "branded_pattern"
    | "logo_composition"
    | "solid_color";
};