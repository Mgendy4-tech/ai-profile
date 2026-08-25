import type {
  ContextualVisualPurpose,
  SelectedContextualVisual,
} from "./types";

export type AspectFillCrop = {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
};

export const calculateAspectFillCrop = (
  sourceWidth: number,
  sourceHeight: number,
  frameWidth: number,
  frameHeight: number
): AspectFillCrop | null => {
  if (
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    frameWidth <= 0 ||
    frameHeight <= 0
  ) {
    return null;
  }

  const sourceRatio = sourceWidth / sourceHeight;
  const frameRatio = frameWidth / frameHeight;

  if (sourceRatio > frameRatio) {
    const sourceCropWidth = sourceHeight * frameRatio;

    return {
      sourceX: (sourceWidth - sourceCropWidth) / 2,
      sourceY: 0,
      sourceWidth: sourceCropWidth,
      sourceHeight,
    };
  }

  const sourceCropHeight = sourceWidth / frameRatio;

  return {
    sourceX: 0,
    sourceY: (sourceHeight - sourceCropHeight) / 2,
    sourceWidth,
    sourceHeight: sourceCropHeight,
  };
};

export const selectContextualVisual = (
  visuals: SelectedContextualVisual[],
  purpose: ContextualVisualPurpose
) => {
  return visuals.find(
    (visual) =>
      visual.role === "contextual_stock" &&
      visual.provenance === "pexels" &&
      visual.purpose === purpose &&
      visual.status === "selected" &&
      visual.source === "pexels" &&
      Boolean(visual.imageUrl)
  ) ?? null;
};

export const canUseContextualVisualInBlock = (blockType: string) => {
  return blockType !== "projectGrid" && blockType !== "projectFeature";
};

export const isCompanyIntroductionSection = (
  sectionId: string,
  title: string
) => {
  const normalizedId = sectionId.toLowerCase().replace(/[^a-z]/g, "");
  const normalizedTitle = title.toLowerCase();

  return (
    normalizedId === "about" ||
    normalizedId === "companyintroduction" ||
    normalizedId === "companyoverview" ||
    normalizedTitle.includes("about") ||
    normalizedTitle.includes("introduction") ||
    normalizedTitle.includes("company overview")
  );
};
