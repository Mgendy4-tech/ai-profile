import type { CoverTemplateId, CurrentFamilyId } from "./cover-library";

export type AuthoredVariantId =
  | "visual-editorial"
  | "visual-gallery"
  | "corporate-structured"
  | "corporate-executive"
  | "product-system"
  | "product-launch";

export type AuthoredVariantSignals = {
  projectCount: number;
  authenticProjectImageCount: number;
  serviceCount: number;
  corporateDetailCount: number;
  productFeatureCount: number;
  useCaseCount: number;
  narrativeCharacterCount: number;
};

export type AuthoredVariantDefinition = {
  id: AuthoredVariantId;
  familyId: CurrentFamilyId;
  displayName: string;
  shortDescription: string;
  visualIntent: string;
  available: true;
  rendererKey: AuthoredVariantId;
  coverTemplateId: CoverTemplateId;
};

export const authoredVariants = [
  { id: "visual-editorial", familyId: "visual-portfolio", displayName: "Editorial Narrative", shortDescription: "A story-led studio profile with generous narrative pacing.", visualIntent: "Editorial, calm, and narrative-led.", available: true, rendererKey: "visual-editorial", coverTemplateId: "authored-cover-v1.editorial-warm" },
  { id: "visual-gallery", familyId: "visual-portfolio", displayName: "Gallery Focus", shortDescription: "A project-forward presentation with a stronger gallery rhythm.", visualIntent: "Image-led, spacious, and portfolio-forward.", available: true, rendererKey: "visual-gallery", coverTemplateId: "authored-cover-v1.architectural-modern" },
  { id: "corporate-structured", familyId: "corporate-services", displayName: "Structured Grid", shortDescription: "A clear service and process layout for fast scanning.", visualIntent: "Ordered, practical, and grid-led.", available: true, rendererKey: "corporate-structured", coverTemplateId: "authored-cover-v1.corporate-clean" },
  { id: "corporate-executive", familyId: "corporate-services", displayName: "Executive Narrative", shortDescription: "A more spacious advisory story with narrative emphasis.", visualIntent: "Measured, strategic, and narrative-led.", available: true, rendererKey: "corporate-executive", coverTemplateId: "authored-cover-v1.dynamic-bold" },
  { id: "product-system", familyId: "product-tech", displayName: "System Features", shortDescription: "A capability-first structure for product systems and features.", visualIntent: "Modular, technical, and feature-led.", available: true, rendererKey: "product-system", coverTemplateId: "authored-cover-v1.dynamic-bold" },
  { id: "product-launch", familyId: "product-tech", displayName: "Launch Story", shortDescription: "A use-case-forward structure for product narratives and adoption.", visualIntent: "Energetic, contextual, and use-case-led.", available: true, rendererKey: "product-launch", coverTemplateId: "authored-cover-v1.creative-soft" },
] as const satisfies readonly AuthoredVariantDefinition[];

export const getAuthoredVariant = (id: string | null | undefined): AuthoredVariantDefinition | null =>
  authoredVariants.find((variant) => variant.id === id) ?? null;

export const variantsForFamily = (familyId: CurrentFamilyId): readonly AuthoredVariantDefinition[] =>
  authoredVariants.filter((variant) => variant.familyId === familyId);

export type AuthoredVariantRecommendation = {
  variantId: AuthoredVariantId;
  reason: string;
};

export const recommendAuthoredVariant = (
  familyId: CurrentFamilyId,
  signals: AuthoredVariantSignals,
): AuthoredVariantRecommendation => {
  if (familyId === "visual-portfolio") {
    const gallery = signals.projectCount > 1 && signals.authenticProjectImageCount >= 2;
    return gallery
      ? { variantId: "visual-gallery", reason: "Recommended for profiles with multiple verified project images." }
      : { variantId: "visual-editorial", reason: "Recommended for a focused portfolio with a stronger narrative arc." };
  }
  if (familyId === "corporate-services") {
    return signals.serviceCount >= 4
      ? { variantId: "corporate-structured", reason: "Recommended for a service-rich profile that benefits from clear scanning." }
      : { variantId: "corporate-executive", reason: "Recommended for a more narrative advisory profile." };
  }
  return signals.productFeatureCount >= Math.max(3, signals.useCaseCount)
    ? { variantId: "product-system", reason: "Recommended for a feature-rich product profile." }
    : { variantId: "product-launch", reason: "Recommended for a product story led by use cases and adoption context." };
};

export const normalizeAuthoredVariant = (
  familyId: CurrentFamilyId,
  requestedVariantId: string | null | undefined,
  signals: AuthoredVariantSignals,
): AuthoredVariantRecommendation => {
  const requested = getAuthoredVariant(requestedVariantId);
  if (requested?.available && requested.familyId === familyId) return { variantId: requested.id, reason: "Selected style preserved for this eligible family." };
  return recommendAuthoredVariant(familyId, signals);
};
