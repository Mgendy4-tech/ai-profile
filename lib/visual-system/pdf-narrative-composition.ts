import type jsPDF from "jspdf";
import type {
  ResolvedArea,
  ResolvedCompositionPage,
} from "./composition-resolver";
import type { SelectedContextualVisual } from "./types";
import {
  resolveDensityAdjustments,
  resolvePagePalette,
  resolveSpacingForDensity,
  resolveTypographyForDensity,
  type PDFDesignTokens,
  type PDFPageMode,
} from "./pdf-design-tokens";
import { resolvePDFPageMode } from "./pdf-page-pacing";

export type NarrativeCompositionVariant =
  | "media_left"
  | "media_right"
  | "top_media"
  | "text_dual_column_or_stacked"
  | "text_forward_no_media";

export type NarrativeContentSection = {
  id: string;
  title: string;
  content: string;
  items: {
    name: string;
    description: string;
  }[];
};

export type PreparedNarrativeItem = {
  titleLines: string[];
  descriptionLines: string[];
  titleY: number;
  descriptionY: number;
  bottom: number;
};

export type NarrativePageActivation = {
  page: ResolvedCompositionPage;
  expectedVisualSlot: "side_media" | "top_media";
  visual: SelectedContextualVisual | null;
};

export type NarrativePageLayout = {
  pageArea: ResolvedArea;
  contentArea: ResolvedArea;
  mediaArea: ResolvedArea | null;
  textArea: ResolvedArea;
  mode: "image" | "image_free";
  variant: NarrativeCompositionVariant;
  pageMode: PDFPageMode;
  textColumns: 1 | 2;
  usesPlaceholderPanel: false;
};

export type PreparedNarrativeSection = {
  id: string;
  treatment: "lead" | "body";
  emphasized: boolean;
  titleLines: string[];
  contentLines: string[];
  x: number;
  titleY: number;
  contentY: number;
  titleFontSize: number;
  titleLineHeight: number;
  contentFontSize: number;
  contentLineHeight: number;
  items: PreparedNarrativeItem[];
  bottom: number;
};

export type PreparedNarrativePage = {
  activation: NarrativePageActivation;
  layout: NarrativePageLayout;
  sections: PreparedNarrativeSection[];
  consumedSectionIds: string[];
};

export type DrawNarrativePageInput = {
  pdf: jsPDF;
  prepared: PreparedNarrativePage;
  companyName: string;
  designTokens: PDFDesignTokens;
  imageSource: string | null;
};

const isWithinPage = (area: ResolvedArea, page: ResolvedArea) =>
  area.x >= page.x &&
  area.y >= page.y &&
  area.width > 0 &&
  area.height > 0 &&
  area.x + area.width <= page.x + page.width &&
  area.y + area.height <= page.y + page.height;

export const getNarrativePageActivation = (
  page: ResolvedCompositionPage
): NarrativePageActivation | null => {
  if (
    page.projectImagePolicy !== "not_applicable" ||
    page.sections.some(
      (section) =>
        section.treatment === "project_grid" ||
        section.treatment === "project_feature"
    )
  ) {
    return null;
  }

  const expectedVisualSlot = page.archetype === "narrative_split"
    ? "side_media"
    : page.archetype === "narrative_stack"
    ? "top_media"
    : null;

  if (!expectedVisualSlot || page.sections.length === 0) {
    return null;
  }

  const assignment = page.visualAssignments.find(
    (candidate) => candidate.slot === expectedVisualSlot
  );
  const visual =
    assignment?.role === "contextual_stock" &&
    assignment.state === "resolved" &&
    assignment.visual?.role === "contextual_stock" &&
    assignment.visual.provenance === "pexels" &&
    assignment.visual.source === "pexels"
      ? assignment.visual
      : null;

  return {
    page,
    expectedVisualSlot,
    visual,
  };
};

export const createNarrativePageLayout = (
  activation: NarrativePageActivation,
  hasImage: boolean,
  pageIndex = 1,
  previousVariant: NarrativeCompositionVariant | null = null,
  previousMode: PDFPageMode | null = null
): NarrativePageLayout | null => {
  const { page } = activation;
  const gap = page.densityParameters.sectionGap;
  const variant = selectNarrativeCompositionVariant(
    activation,
    hasImage,
    pageIndex,
    previousVariant
  );
  const pageMode = resolvePDFPageMode({
    pageIndex,
    pageRole: page.pageRole,
    density: page.density,
    hasImage,
    previousMode,
  });
  const mediaRatioScale = resolveDensityAdjustments(
    page.density
  ).mediaRatioScale;
  const baseMediaWidth = page.sectionArea.x - gap - page.contentArea.x;
  const baseMediaHeight = page.sectionArea.y - gap - page.contentArea.y;
  const splitMediaWidth = baseMediaWidth * mediaRatioScale;
  const stackMediaHeight = baseMediaHeight * mediaRatioScale;
  const mediaArea: ResolvedArea | null = variant === "media_left"
    ? {
        x: page.contentArea.x,
        y: page.contentArea.y,
        width: splitMediaWidth,
        height: page.contentArea.height,
      }
    : variant === "media_right"
    ? {
        x: page.contentArea.x + page.contentArea.width - splitMediaWidth,
        y: page.contentArea.y,
        width: splitMediaWidth,
        height: page.contentArea.height,
      }
    : variant === "top_media"
    ? {
        x: page.contentArea.x,
        y: page.contentArea.y,
        width: page.contentArea.width,
        height: stackMediaHeight,
      }
    : null;
  const textArea: ResolvedArea = variant === "media_left" && mediaArea
    ? {
        x: mediaArea.x + mediaArea.width + gap,
        y: page.contentArea.y,
        width: page.contentArea.width - mediaArea.width - gap,
        height: page.contentArea.height,
      }
    : variant === "media_right" && mediaArea
    ? {
        x: page.contentArea.x,
        y: page.contentArea.y,
        width: page.contentArea.width - mediaArea.width - gap,
        height: page.contentArea.height,
      }
    : variant === "top_media" && mediaArea
    ? {
        x: page.contentArea.x,
        y: mediaArea.y + mediaArea.height + gap,
        width: page.contentArea.width,
        height: page.contentArea.height - mediaArea.height - gap,
      }
    : { ...page.contentArea };
  const areas = [
    page.pageArea,
    page.contentArea,
    ...(mediaArea ? [mediaArea] : []),
    textArea,
  ];

  if (!areas.every((area) => isWithinPage(area, page.pageArea))) {
    return null;
  }

  return {
    pageArea: { ...page.pageArea },
    contentArea: { ...page.contentArea },
    mediaArea,
    textArea,
    mode: hasImage && mediaArea ? "image" : "image_free",
    variant,
    pageMode,
    textColumns:
      variant === "text_dual_column_or_stacked" && page.sections.length > 1
        ? 2
        : 1,
    usesPlaceholderPanel: false,
  };
};

export const selectNarrativeCompositionVariant = (
  activation: NarrativePageActivation,
  hasImage: boolean,
  pageIndex: number,
  previousVariant: NarrativeCompositionVariant | null
): NarrativeCompositionVariant => {
  if (!hasImage || !activation.visual) {
    return activation.page.archetype === "narrative_stack" &&
      activation.page.sections.length > 1
      ? "text_dual_column_or_stacked"
      : "text_forward_no_media";
  }

  if (activation.page.archetype === "narrative_stack") {
    return "top_media";
  }

  const preferred = pageIndex % 2 === 0 ? "media_right" : "media_left";
  return preferred === previousVariant
    ? preferred === "media_left"
      ? "media_right"
      : "media_left"
    : preferred;
};

export const prepareNarrativePage = (
  pdf: jsPDF,
  activation: NarrativePageActivation,
  availableSections: readonly NarrativeContentSection[],
  hasImage: boolean,
  designTokens: PDFDesignTokens,
  pageIndex = 1,
  previousVariant: NarrativeCompositionVariant | null = null,
  previousMode: PDFPageMode | null = null
): PreparedNarrativePage | null => {
  const layout = createNarrativePageLayout(
    activation,
    hasImage,
    pageIndex,
    previousVariant,
    previousMode
  );

  if (!layout) {
    return null;
  }

  const sectionsById = new Map(
    availableSections.map((section) => [section.id, section])
  );
  const spacingTokens = resolveSpacingForDensity(
    designTokens,
    activation.page.density
  );
  const typography = resolveTypographyForDensity(
    designTokens,
    activation.page.density
  );
  const spacing = spacingTokens.sectionGap;
  const rightInset = spacingTokens.xs;
  const columnGap = layout.textColumns === 2 ? spacingTokens.lg : 0;
  const textWidth =
    (layout.textArea.width - columnGap) / layout.textColumns - rightInset;
  const bottomLimit =
    layout.textArea.y + layout.textArea.height - spacingTokens.sm;
  const cursorYs = Array.from(
    { length: layout.textColumns },
    () => layout.textArea.y + spacingTokens.xl
  );
  const preparedSections: PreparedNarrativeSection[] = [];

  for (const [sectionIndex, reference] of activation.page.sections.entries()) {
    if (
      reference.treatment === "project_grid" ||
      reference.treatment === "project_feature"
    ) {
      return null;
    }

    const section = sectionsById.get(reference.sectionId);

    if (!section?.title.trim()) {
      return null;
    }

    const emphasized =
      reference.treatment === "lead" ||
      activation.page.hierarchy.primarySectionId === reference.sectionId;
    const headingRole = emphasized ? typography.h1 : typography.h2;
    const titleFontSize = headingRole.fontSize;
    const titleLineHeight = headingRole.lineHeight;
    const contentFontSize = typography.body.fontSize;
    const contentLineHeight = typography.body.lineHeight;
    const columnIndex = layout.textColumns === 2 ? sectionIndex % 2 : 0;
    const sectionX =
      layout.textArea.x + columnIndex * (textWidth + rightInset + columnGap);

    pdf.setFont("helvetica", headingRole.fontStyle);
    pdf.setFontSize(titleFontSize);
    const titleLines = pdf.splitTextToSize(
      section.title.trim(),
      textWidth
    ) as string[];
    pdf.setFont("helvetica", typography.body.fontStyle);
    pdf.setFontSize(contentFontSize);
    const contentLines = section.content.trim()
      ? (pdf.splitTextToSize(section.content.trim(), textWidth) as string[])
      : [];
    const titleY = cursorYs[columnIndex];
    const contentY =
      titleY + titleLines.length * titleLineHeight + spacingTokens.sm;
    let bottom = contentY + contentLines.length * contentLineHeight;
    const preparedItems: PreparedNarrativeItem[] = [];

    for (const item of section.items) {
      if (!item.name.trim()) {
        return null;
      }

      pdf.setFont("helvetica", typography.h3.fontStyle);
      pdf.setFontSize(typography.h3.fontSize);
      const itemTitleLines = pdf.splitTextToSize(
        item.name.trim(),
        textWidth
      ) as string[];
      pdf.setFont("helvetica", typography.caption.fontStyle);
      pdf.setFontSize(typography.caption.fontSize);
      const itemDescriptionLines = item.description.trim()
        ? (pdf.splitTextToSize(item.description.trim(), textWidth) as string[])
        : [];
      const itemTitleY = bottom + spacingTokens.sm;
      const itemDescriptionY =
        itemTitleY + itemTitleLines.length * typography.h3.lineHeight +
        spacingTokens.xs;
      const itemBottom =
        itemDescriptionY +
        itemDescriptionLines.length * typography.caption.lineHeight;

      preparedItems.push({
        titleLines: itemTitleLines,
        descriptionLines: itemDescriptionLines,
        titleY: itemTitleY,
        descriptionY: itemDescriptionY,
        bottom: itemBottom,
      });
      bottom = itemBottom;
    }

    if (bottom > bottomLimit) {
      return null;
    }

    preparedSections.push({
      id: section.id,
      treatment: reference.treatment,
      emphasized,
      titleLines,
      contentLines,
      x: sectionX,
      titleY,
      contentY,
      titleFontSize,
      titleLineHeight,
      contentFontSize,
      contentLineHeight,
      items: preparedItems,
      bottom,
    });
    cursorYs[columnIndex] = bottom + spacing;
  }

  return {
    activation,
    layout,
    sections: preparedSections,
    consumedSectionIds: preparedSections.map((section) => section.id),
  };
};

export const drawNarrativePage = ({
  pdf,
  prepared,
  companyName,
  designTokens,
  imageSource,
}: DrawNarrativePageInput): {
  consumedSectionIds: string[];
  renderedVisual: SelectedContextualVisual | null;
} => {
  if (!companyName.trim() || prepared.sections.length === 0) {
    throw new Error("Narrative page data is incomplete.");
  }

  const { layout, activation } = prepared;
  const palette = resolvePagePalette(designTokens, layout.pageMode);
  const typography = resolveTypographyForDensity(
    designTokens,
    activation.page.density
  );
  const spacing = resolveSpacingForDensity(
    designTokens,
    activation.page.density
  );
  pdf.setFillColor(
    palette.background[0],
    palette.background[1],
    palette.background[2]
  );
  pdf.rect(
    layout.pageArea.x,
    layout.pageArea.y,
    layout.pageArea.width,
    layout.pageArea.height,
    "F"
  );

  if (imageSource && activation.visual && layout.mediaArea) {
    pdf.addImage(
      imageSource,
      "JPEG",
      layout.mediaArea.x,
      layout.mediaArea.y,
      layout.mediaArea.width,
      layout.mediaArea.height
    );
  } else if (layout.mediaArea) {
    pdf.setDrawColor(
      palette.accent[0],
      palette.accent[1],
      palette.accent[2]
    );
    pdf.setLineWidth(designTokens.rules.hairlineWidth * 2.5);
    if (activation.page.archetype === "narrative_split") {
      pdf.line(
        layout.mediaArea.x + spacing.lg,
        layout.mediaArea.y + spacing.xl,
        layout.mediaArea.x + spacing.lg,
        layout.mediaArea.y + layout.mediaArea.height - spacing.xl
      );
    } else {
      pdf.line(
        layout.mediaArea.x + spacing.lg,
        layout.mediaArea.y + layout.mediaArea.height - spacing.lg,
        layout.mediaArea.x + layout.mediaArea.width - spacing.lg,
        layout.mediaArea.y + layout.mediaArea.height - spacing.lg
      );
    }
  } else {
    pdf.setDrawColor(
      palette.accent[0],
      palette.accent[1],
      palette.accent[2]
    );
    pdf.setLineWidth(designTokens.rules.hairlineWidth);
    pdf.line(
      layout.contentArea.x,
      layout.contentArea.y,
      layout.contentArea.x + designTokens.rules.shortRuleWidth,
      layout.contentArea.y
    );
    pdf.line(
      layout.contentArea.x + layout.contentArea.width,
      layout.contentArea.y,
      layout.contentArea.x + layout.contentArea.width,
      layout.contentArea.y + layout.contentArea.height
    );
  }

  pdf.setTextColor(
    palette.secondaryText[0],
    palette.secondaryText[1],
    palette.secondaryText[2]
  );
  pdf.setFont("helvetica", typography.overline.fontStyle);
  pdf.setFontSize(typography.overline.fontSize);
  pdf.text(
    activation.page.pageRole.toUpperCase(),
    layout.textArea.x,
    layout.textArea.y + typography.overline.lineHeight
  );

  prepared.sections.forEach((section) => {
    pdf.setTextColor(
      palette.primaryText[0],
      palette.primaryText[1],
      palette.primaryText[2]
    );
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(section.titleFontSize);
    pdf.text(section.titleLines, section.x, section.titleY);

    if (section.emphasized) {
      pdf.setDrawColor(
        palette.accent[0],
        palette.accent[1],
        palette.accent[2]
      );
      pdf.setLineWidth(designTokens.rules.hairlineWidth * 2);
      pdf.line(
        section.x,
        section.contentY - spacing.xs,
        section.x + Math.min(
          designTokens.rules.shortRuleWidth,
          layout.textArea.width
        ),
        section.contentY - spacing.xs
      );
    }

    if (section.contentLines.length > 0) {
      pdf.setTextColor(
        palette.secondaryText[0],
        palette.secondaryText[1],
        palette.secondaryText[2]
      );
      pdf.setFont("helvetica", typography.body.fontStyle);
      pdf.setFontSize(section.contentFontSize);
      pdf.text(section.contentLines, section.x, section.contentY);
    }

    section.items.forEach((item) => {
      pdf.setTextColor(
        palette.primaryText[0],
        palette.primaryText[1],
        palette.primaryText[2]
      );
      pdf.setFont("helvetica", typography.h3.fontStyle);
      pdf.setFontSize(typography.h3.fontSize);
      pdf.text(item.titleLines, section.x, item.titleY);

      if (item.descriptionLines.length > 0) {
        pdf.setTextColor(
          palette.secondaryText[0],
          palette.secondaryText[1],
          palette.secondaryText[2]
        );
        pdf.setFont("helvetica", typography.caption.fontStyle);
        pdf.setFontSize(typography.caption.fontSize);
        pdf.text(item.descriptionLines, section.x, item.descriptionY);
      }
    });
  });

  return {
    consumedSectionIds: [...prepared.consumedSectionIds],
    renderedVisual: imageSource && layout.mediaArea ? activation.visual : null,
  };
};
