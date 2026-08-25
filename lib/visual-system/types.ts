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

export type ContextualVisualPurpose =
  VisualDirection["imageBriefs"][number]["purpose"];

export type ContextualVisualPlacement =
  VisualDirection["imageBriefs"][number]["placement"];

export type ContextualVisualAspectRatio =
  VisualDirection["imageBriefs"][number]["aspectRatio"];

export type SelectedContextualVisual = {
  role: "contextual_stock";
  provenance: "pexels";
  briefId: string;
  purpose: ContextualVisualPurpose;
  placement: ContextualVisualPlacement;
  aspectRatio: ContextualVisualAspectRatio;
  status: "selected" | "fallback";
  source: "pexels" | null;
  photographer: string | null;
  imageUrl: string | null;
  width: number | null;
  height: number | null;
  overallScore: number | null;
  fallbackReason: string | null;
};

export type UserUploadedProjectVisual = {
  role: "project_image";
  provenance: "user_upload";
  projectId: string;
  imageUrl: string;
};

export type PdfVisualAsset =
  | SelectedContextualVisual
  | UserUploadedProjectVisual;

export type SelectVisualsResponse = {
  visuals: SelectedContextualVisual[];
};

export type PageCompositionRole =
  | "cover"
  | "introduction"
  | "narrative"
  | "projects";

export type PageCompositionArchetype =
  | "cover_editorial"
  | "narrative_split"
  | "narrative_stack"
  | "project_grid"
  | "project_feature";

export type PageCompositionDensity =
  | "minimal"
  | "balanced"
  | "rich";

export type PageCompositionSection =
  | {
      sectionId: string;
      treatment: "lead" | "body";
    }
  | {
      sectionId: string;
      treatment: "project_grid" | "project_feature";
      projectNames: string[];
    };

export type PageCompositionVisualAssignment = {
  role: "contextual_stock";
  briefId: string;
  slot: "hero" | "side_media" | "top_media";
};

export type PageCompositionHierarchy = {
  primarySectionId?: string;
  emphasis: "visual" | "content" | "balanced";
};

export type PageCompositionPage = {
  id: string;
  pageRole: PageCompositionRole;
  archetype: PageCompositionArchetype;
  density: PageCompositionDensity;
  sections: PageCompositionSection[];
  visualAssignments: PageCompositionVisualAssignment[];
  hierarchy: PageCompositionHierarchy;
};

export type PageCompositionPlan = {
  version: 2;
  pages: PageCompositionPage[];
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
