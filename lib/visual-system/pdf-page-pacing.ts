import type { PageCompositionDensity, PageCompositionRole } from "./types";
import type { PDFPageMode } from "./pdf-design-tokens";

export type PDFPagePacingInput = {
  pageIndex: number;
  pageRole: PageCompositionRole;
  density: PageCompositionDensity;
  hasImage: boolean;
  previousMode: PDFPageMode | null;
};

const NARRATIVE_RHYTHM: readonly PDFPageMode[] = ["light", "dark", "accent"];

export const resolvePDFPageMode = ({
  pageIndex,
  pageRole,
  density,
  hasImage,
  previousMode,
}: PDFPagePacingInput): PDFPageMode => {
  if (pageRole === "cover") {
    return hasImage ? "dark" : "accent";
  }

  if (density === "rich") {
    return "light";
  }

  let mode = NARRATIVE_RHYTHM[Math.max(0, pageIndex - 1) % NARRATIVE_RHYTHM.length];

  if (mode === previousMode) {
    const currentIndex = NARRATIVE_RHYTHM.indexOf(mode);
    mode = NARRATIVE_RHYTHM[(currentIndex + 1) % NARRATIVE_RHYTHM.length];
  }

  return mode;
};
