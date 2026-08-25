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
} from "./pdf-design-tokens";

export type CoverEditorialMode = "image" | "image_free";

export type CoverEditorialLayout = {
  mode: CoverEditorialMode;
  pageArea: ResolvedArea;
  heroArea: ResolvedArea;
  panelArea: ResolvedArea;
  accentArea: ResolvedArea;
  logoArea: ResolvedArea;
  eyebrowPosition: { x: number; y: number };
  titleArea: ResolvedArea;
  sectionsConsumed: [];
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
  hasHeroImage: boolean
): CoverEditorialLayout | null => {
  if (page.pageRole !== "cover" || page.archetype !== "cover_editorial") {
    return null;
  }

  const pageArea = copyArea(page.pageArea);
  const heroArea = copyArea(page.contentArea);
  const panelWidth = page.sectionArea.width;
  const panelArea: ResolvedArea = {
    x: page.contentArea.x,
    y: page.contentArea.y,
    width: panelWidth,
    height: page.contentArea.height,
  };
  const accentArea: ResolvedArea = hasHeroImage
    ? {
        x: panelArea.x + panelArea.width - 1.5,
        y: panelArea.y,
        width: 1.5,
        height: panelArea.height,
      }
    : {
        x: page.contentArea.x + page.contentArea.width * 0.62,
        y: page.contentArea.y,
        width: page.contentArea.width * 0.38,
        height: page.contentArea.height,
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
    heroArea,
    panelArea,
    accentArea,
    logoArea,
    titleArea,
  ];

  if (!areas.every((area) => isAreaWithinPage(area, pageArea))) {
    return null;
  }

  return {
    mode: hasHeroImage ? "image" : "image_free",
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
  };
};

export const drawCoverEditorial = ({
  pdf,
  page,
  companyName,
  designTokens,
  heroImageSource,
  logo,
}: DrawCoverEditorialInput): { renderedVisual: SelectedContextualVisual | null } => {
  if (!companyName.trim()) {
    throw new Error("A company name is required for the editorial cover.");
  }

  const activation = getCoverEditorialActivation({
    sourceVersion: 2,
    unit: "mm",
    pageSize: { width: 210, height: 297 },
    pages: [page],
  });
  const layout = createCoverEditorialLayout(page, Boolean(heroImageSource));

  if (!activation || !layout) {
    throw new Error("The resolved page cannot be rendered as an editorial cover.");
  }

  const lightPalette = resolvePagePalette(designTokens, "light");
  const accentPalette = resolvePagePalette(designTokens, "accent");
  const typography = resolveTypographyForDensity(designTokens, page.density);

  pdf.setFillColor(
    lightPalette.background[0],
    lightPalette.background[1],
    lightPalette.background[2]
  );
  pdf.rect(
    layout.pageArea.x,
    layout.pageArea.y,
    layout.pageArea.width,
    layout.pageArea.height,
    "F"
  );

  if (heroImageSource) {
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

  if (layout.mode === "image") {
    pdf.rect(
      layout.panelArea.x,
      layout.panelArea.y,
      layout.panelArea.width,
      layout.panelArea.height,
      "F"
    );
  } else {
    pdf.rect(
      layout.accentArea.x,
      layout.accentArea.y,
      layout.accentArea.width,
      layout.accentArea.height,
      "F"
    );
  }

  const textColor = layout.mode === "image"
    ? accentPalette.primaryText
    : lightPalette.primaryText;
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
  };
};
