import type { jsPDF } from "jspdf";
import type { PreparedImageSlot, TemplateInstance } from "../types";

export type AuthoredLogoFrame = Readonly<{ x: number; y: number; width: number; height: number }>;
export type AuthoredLogoShape = "wide" | "balanced" | "tall";
export type AuthoredLogoPlacementVariant = Readonly<Record<AuthoredLogoShape, AuthoredLogoFrame>>;

export const classifyAuthoredLogoShape = (aspectRatio: number): AuthoredLogoShape =>
  aspectRatio >= 1.8 ? "wide" : aspectRatio <= 0.72 ? "tall" : "balanced";

export const preparedOptionalLogo = <T extends object>(instance: TemplateInstance<T>, slotId = "logo"): PreparedImageSlot | null => {
  const slot = instance.preparedSlots[slotId];
  if (!slot) return null;
  if (slot.kind !== "image") throw new Error(`Prepared logo slot ${slotId} is not an image.`);
  return slot;
};

export const containImageInFrame = (frame: AuthoredLogoFrame, aspectRatio: number) => {
  const frameAspectRatio = frame.width / frame.height;
  if (aspectRatio >= frameAspectRatio) {
    const height = frame.width / aspectRatio;
    return { x: frame.x, y: frame.y + (frame.height - height) / 2, width: frame.width, height };
  }
  const width = frame.height * aspectRatio;
  return { x: frame.x + (frame.width - width) / 2, y: frame.y, width, height: frame.height };
};

export const drawContainedOptionalLogo = (
  pdf: jsPDF,
  logo: PreparedImageSlot | null,
  frames: AuthoredLogoPlacementVariant,
  background?: readonly [number, number, number],
) => {
  if (!logo) return null;
  const shape = classifyAuthoredLogoShape(logo.aspectRatio);
  const frame = frames[shape];
  if (background) {
    pdf.setFillColor(...background);
    pdf.rect(frame.x, frame.y, frame.width, frame.height, "F");
  }
  const placement = containImageInFrame(frame, logo.aspectRatio);
  pdf.addImage(logo.source.source, logo.source.format, placement.x, placement.y, placement.width, placement.height);
  return { ...placement, shape, variant: shape };
};
