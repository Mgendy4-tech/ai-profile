import type { AuthoredVariantId } from "./variant-registry";

export type VariantPreviewBlock = {
  kind: "image" | "text" | "card" | "accent";
  size: "short" | "medium" | "tall" | "wide";
};

export type AuthoredVariantPreview = {
  variantId: AuthoredVariantId;
  rhythm: string;
  imageEmphasis: string;
  textDensity: string;
  balance: string;
  accentTreatment: string;
  bestFor: string;
  blocks: readonly VariantPreviewBlock[];
};

export const authoredVariantPreviews = [
  {
    variantId: "visual-editorial",
    rhythm: "One strong image with a guided narrative block.",
    imageEmphasis: "Focused image emphasis",
    textDensity: "Generous text pacing",
    balance: "Narrative-led balance",
    accentTreatment: "Quiet editorial accent",
    bestFor: "Best for a focused portfolio story.",
    blocks: [
      { kind: "text", size: "wide" },
      { kind: "image", size: "tall" },
      { kind: "text", size: "medium" },
      { kind: "accent", size: "short" },
    ],
  },
  {
    variantId: "visual-gallery",
    rhythm: "A spacious sequence of image-led project moments.",
    imageEmphasis: "Multiple image emphasis",
    textDensity: "Light supporting text",
    balance: "Gallery-led balance",
    accentTreatment: "Minimal image captions",
    bestFor: "Best for a broader visual portfolio.",
    blocks: [
      { kind: "image", size: "wide" },
      { kind: "image", size: "medium" },
      { kind: "image", size: "medium" },
      { kind: "text", size: "short" },
    ],
  },
  {
    variantId: "corporate-structured",
    rhythm: "A clear grid and list rhythm for quick scanning.",
    imageEmphasis: "Low image emphasis",
    textDensity: "Compact service text",
    balance: "Grid-led balance",
    accentTreatment: "Consistent section markers",
    bestFor: "Best for service-rich teams and clear scanning.",
    blocks: [
      { kind: "accent", size: "wide" },
      { kind: "card", size: "medium" },
      { kind: "card", size: "medium" },
      { kind: "card", size: "medium" },
    ],
  },
  {
    variantId: "corporate-executive",
    rhythm: "A larger narrative block paired with a focused accent panel.",
    imageEmphasis: "Selective image emphasis",
    textDensity: "Measured narrative text",
    balance: "Narrative-and-panel balance",
    accentTreatment: "Distinct executive accent panel",
    bestFor: "Best for a more narrative advisory profile.",
    blocks: [
      { kind: "text", size: "tall" },
      { kind: "accent", size: "medium" },
      { kind: "card", size: "wide" },
      { kind: "text", size: "short" },
    ],
  },
  {
    variantId: "product-system",
    rhythm: "Modular feature blocks arranged for product scanning.",
    imageEmphasis: "Targeted product imagery",
    textDensity: "Dense feature text",
    balance: "Modular block balance",
    accentTreatment: "Technical system accents",
    bestFor: "Best for feature-rich product systems.",
    blocks: [
      { kind: "accent", size: "short" },
      { kind: "card", size: "medium" },
      { kind: "card", size: "medium" },
      { kind: "card", size: "medium" },
    ],
  },
  {
    variantId: "product-launch",
    rhythm: "A product story that moves from hero to use case.",
    imageEmphasis: "Hero image emphasis",
    textDensity: "Contextual supporting text",
    balance: "Hero-and-use-case balance",
    accentTreatment: "Energetic launch accent",
    bestFor: "Best for launch stories and adoption context.",
    blocks: [
      { kind: "image", size: "wide" },
      { kind: "text", size: "medium" },
      { kind: "accent", size: "short" },
      { kind: "card", size: "medium" },
    ],
  },
] as const satisfies readonly AuthoredVariantPreview[];

export const getAuthoredVariantPreview = (variantId: AuthoredVariantId): AuthoredVariantPreview => {
  const preview = authoredVariantPreviews.find((candidate) => candidate.variantId === variantId);
  if (!preview) throw new Error(`Missing authored variant preview: ${variantId}`);
  return preview;
};

export const previewSignature = (preview: AuthoredVariantPreview): string =>
  preview.blocks.map((block) => `${block.kind}-${block.size}`).join("|");
