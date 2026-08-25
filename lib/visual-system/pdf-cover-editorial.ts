import type jsPDF from "jspdf";
import type {
  ResolvedArea,
  ResolvedCompositionPage,
  ResolvedPageComposition,
} from "./composition-resolver";
import type { SelectedContextualVisual } from "./types";
import {
  resolvePagePalette,
  resolveTypographyForDensity,
  type PDFDesignTokens,
  type PDFPageMode,
} from "./pdf-design-tokens";
import { resolvePDFPageMode } from "./pdf-page-pacing";

export type CoverEditorialMode = "image" | "image_free";
export type CoverEditorialVariant =
  | "full_bleed_overlay"
  | "asymmetric_split"
  | "typographic_hero";

export type CoverEditorialLayout = {
  mode: CoverEditorialMode;
  variant: CoverEditorialVariant;
  pageMode: PDFPageMode;
  pageArea: ResolvedArea;
  heroArea: ResolvedArea | null;
  panelArea: ResolvedArea;
  accentArea: ResolvedArea;
  logoArea: ResolvedArea;
  eyebrowPosition: { x: number; y: number };
  titleArea: ResolvedArea;
  sectionsConsumed: [];
  usesPlaceholderPanel: false;
};

export type CoverEditorialActivation = {
  page: ResolvedCompositionPage;
  heroVisual: SelectedContextualVisual | null;
};

export type DrawCoverEditorialInput = {
  pdf: jsPDF;
  page: ResolvedCompositionPage;
  companyName: string;
  designTokens: PDFDesignTokens;
  heroImageSource: string | null;
  logo?: {
    source: string;
    width: number;
    height: number;
  } | null;
};

const copyArea = (area: ResolvedArea): ResolvedArea => ({ ...area });

const isAreaWithinPage = (area: ResolvedArea, page: ResolvedArea) =>
  area.x >= page.x &&
  area.y >= page.y &&
  area.width > 0 &&
  area.height > 0 &&
  area.x + area.width <= page.x + page.width &&
  area.y + area.height <= page.y + page.height;

export const getCoverEditorialActivation = (
  composition: ResolvedPageComposition
): CoverEditorialActivation | null => {
  const page = composition.pages[0];

  if (
    !page ||
    page.pageRole !== "cover" ||
    page.archetype !== "cover_editorial" ||
    page.projectImagePolicy !== "not_applicable"
  ) {
    return null;
  }

  const heroAssignment = page.visualAssignments.find(
    (assignment) => assignment.slot === "hero"
  );

  return {
    page,
    heroVisual:
      heroAssignment?.state === "resolved" &&
      heroAssignment.role === "contextual_stock"
        ? heroAssignment.visual
        : null,
  };
};

export const createCoverEditorialLayout = (
  page: ResolvedCompositionPage,
  hasHeroImage: boolean,
  heroVisual: SelectedContextualVisual | null = null
): CoverEditorialLayout | null => {
  if (page.pageRole !== "cover" || page.archetype !== "cover_editorial") {
    return null;
  }

  const pageArea = copyArea(page.pageArea);
  const variant = selectCoverEditorialVariant(hasHeroImage, heroVisual);
  const pageMode = resolvePDFPageMode({
    pageIndex: 0,
    pageRole: "cover",
    density: page.density,
    hasImage: variant !== "typographic_hero",
    previousMode: null,
  });
  const heroArea: ResolvedArea | null = variant === "full_bleed_overlay"
    ? {
        x: page.pageArea.x,
        y: page.pageArea.y,
        width: page.pageArea.width,
        height: page.pageArea.height * 0.69,
      }
    : variant === "asymmetric_split"
    ? {
        x: page.contentArea.x + page.contentArea.width * 0.45,
        y: page.contentArea.y,
        width: page.contentArea.width * 0.55,
        height: page.contentArea.height,
      }
    : null;
  const panelArea: ResolvedArea = variant === "full_bleed_overlay"
    ? {
        x: page.contentArea.x,
        y: page.contentArea.y + page.contentArea.height * 0.5,
        width: page.contentArea.width * 0.56,
        height: page.contentArea.height * 0.44,
      }
    : {
        x: page.contentArea.x,
        y: page.contentArea.y,
        width: page.contentArea.width * 0.48,
        height: page.contentArea.height,
      };
  const accentArea: ResolvedArea = variant === "typographic_hero"
    ? {
        x: page.contentArea.x + page.contentArea.width - 2,
        y: page.contentArea.y,
        width: 2,
        height: page.contentArea.height,
      }
    : {
        x: panelArea.x,
        y: panelArea.y,
        width: panelArea.width,
        height: panelArea.height,
      };
  const logoArea: ResolvedArea = {
    x: panelArea.x + 10,
    y: panelArea.y + 12,
    width: Math.max(1, panelArea.width - 20),
    height: 16,
  };
  const titleArea: ResolvedArea = {
    x: panelArea.x + 10,
    y: panelArea.y + panelArea.height * 0.42,
    width: Math.max(1, panelArea.width - 20),
    height: panelArea.height * 0.4,
  };

  const areas = [
    ...(heroArea ? [heroArea] : []),
    panelArea,
    accentArea,
    logoArea,
    titleArea,
  ];

  if (!areas.every((area) => isAreaWithinPage(area, pageArea))) {
    return null;
  }

  return {
    mode: variant === "typographic_hero" ? "image_free" : "image",
    variant,
    pageMode,
    pageArea,
    heroArea,
    panelArea,
    accentArea,
    logoArea,
    eyebrowPosition: {
      x: titleArea.x,
      y: titleArea.y,
    },
    titleArea,
    sectionsConsumed: [],
    usesPlaceholderPanel: false,
  };
};

export const selectCoverEditorialVariant = (
  hasHeroImage: boolean,
  heroVisual: SelectedContextualVisual | null
): CoverEditorialVariant => {
  if (!hasHeroImage || !heroVisual) {
    return "typographic_hero";
  }

  const ratio = heroVisual.width && heroVisual.height
    ? heroVisual.width / heroVisual.height
    : heroVisual.aspectRatio === "16:9"
    ? 16 / 9
    : heroVisual.aspectRatio === "4:3"
    ? 4 / 3
    : 1;

  return ratio >= 1.5 ? "full_bleed_overlay" : "asymmetric_split";
};

export const drawCoverEditorial = ({
  pdf,
  page,
  companyName,
  designTokens,
  heroImageSource,
  logo,
}: DrawCoverEditorialInput): {
  renderedVisual: SelectedContextualVisual | null;
  variant: CoverEditorialVariant;
  pageMode: PDFPageMode;
} => {
  if (!companyName.trim()) {
    throw new Error("A company name is required for the editorial cover.");
  }

  const activation = getCoverEditorialActivation({
    sourceVersion: 2,
    unit: "mm",
    pageSize: { width: 210, height: 297 },
    pages: [page],
  });
  const layout = createCoverEditorialLayout(
    page,
    Boolean(heroImageSource),
    activation?.heroVisual ?? null
  );

  if (!activation || !layout) {
    throw new Error("The resolved page cannot be rendered as an editorial cover.");
  }

  const lightPalette = resolvePagePalette(designTokens, "light");
  const coverPalette = resolvePagePalette(designTokens, layout.pageMode);
  const accentPalette = resolvePagePalette(designTokens, "accent");
  const typography = resolveTypographyForDensity(designTokens, page.density);

  const basePalette = layout.variant === "typographic_hero"
    ? coverPalette
    : lightPalette;
  pdf.setFillColor(
    basePalette.background[0],
    basePalette.background[1],
    basePalette.background[2]
  );
  pdf.rect(
    layout.pageArea.x,
    layout.pageArea.y,
    layout.pageArea.width,
    layout.pageArea.height,
    "F"
  );

  if (heroImageSource && layout.heroArea) {
    pdf.addImage(
      heroImageSource,
      "JPEG",
      layout.heroArea.x,
      layout.heroArea.y,
      layout.heroArea.width,
      layout.heroArea.height
    );
  }

  pdf.setFillColor(
    accentPalette.background[0],
    accentPalette.background[1],
    accentPalette.background[2]
  );

  if (layout.variant !== "typographic_hero") {
    pdf.rect(
      layout.panelArea.x,
      layout.panelArea.y,
      layout.panelArea.width,
      layout.panelArea.height,
      "F"
    );
  } else {
    pdf.setDrawColor(
      coverPalette.primaryText[0],
      coverPalette.primaryText[1],
      coverPalette.primaryText[2]
    );
    pdf.setLineWidth(designTokens.rules.hairlineWidth);
    pdf.rect(
      page.contentArea.x,
      page.contentArea.y,
      page.contentArea.width,
      page.contentArea.height
    );
  }

  const textColor = layout.variant === "typographic_hero"
    ? coverPalette.primaryText
    : accentPalette.primaryText;
  pdf.setTextColor(textColor[0], textColor[1], textColor[2]);
  pdf.setFont("helvetica", typography.overline.fontStyle);
  pdf.setFontSize(typography.overline.fontSize);
  pdf.text(
    "COMPANY PROFILE",
    layout.eyebrowPosition.x,
    layout.eyebrowPosition.y
  );

  pdf.setDrawColor(textColor[0], textColor[1], textColor[2]);
  pdf.setLineWidth(designTokens.rules.hairlineWidth);
  pdf.line(
    layout.titleArea.x,
    layout.titleArea.y + designTokens.spacing.md,
    layout.titleArea.x + Math.min(
      designTokens.rules.shortRuleWidth,
      layout.titleArea.width
    ),
    layout.titleArea.y + designTokens.spacing.md
  );

  pdf.setFont("helvetica", typography.display.fontStyle);
  pdf.setFontSize(typography.display.fontSize);
  const titleLines = pdf.splitTextToSize(
    companyName.trim(),
    layout.titleArea.width
  ) as string[];
  pdf.text(
    titleLines.slice(0, 5),
    layout.titleArea.x,
    layout.titleArea.y + designTokens.spacing.xl + designTokens.spacing.xs
  );

  if (logo?.source && logo.width > 0 && logo.height > 0) {
    const ratio = logo.width / logo.height;
    const renderedHeight = Math.min(layout.logoArea.height, layout.logoArea.width / ratio);
    const renderedWidth = renderedHeight * ratio;
    pdf.addImage(
      logo.source,
      layout.logoArea.x,
      layout.logoArea.y,
      renderedWidth,
      renderedHeight
    );
  }

  return {
    renderedVisual: heroImageSource ? activation.heroVisual : null,
    variant: layout.variant,
    pageMode: layout.pageMode,
  };
};
