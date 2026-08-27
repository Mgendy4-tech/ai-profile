import type jsPDF from "jspdf";
import type {
  ResolvedArea,
  ResolvedCompositionPage,
} from "./composition-resolver";
import type { SelectedContextualVisual } from "./types";
import {
  resolvePagePalette,
  getPDFLineHeightFactor,
  resolveSpacingForDensity,
  resolveTypographyForDensity,
  type PDFDesignTokens,
  type PDFPageMode,
} from "./pdf-design-tokens";
import { resolvePDFPageMode } from "./pdf-page-pacing";
import {
  resolvePDFArtDirection,
  type PDFArtDirection,
  type PDFCompositionFamily,
} from "./pdf-art-direction";
import { PDF_EDITORIAL_TYPE_CONSTRAINTS } from "./pdf-editorial-typesetting";

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
  artDirection: PDFArtDirection;
};

export type PDFTextBounds = { top: number; bottom: number };

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
  headingBounds: PDFTextBounds;
  ruleY: number;
  bodyBounds: PDFTextBounds | null;
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
  previousMode: PDFPageMode | null = null,
  textLength = 0,
  previousFamily: PDFCompositionFamily | null = null
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
  const artDirection = resolvePDFArtDirection({
    pageIndex,
    pageRole: page.pageRole,
    archetype: page.archetype,
    density: page.density,
    sectionCount: page.sections.length,
    textLength,
    hasContextualImage: hasImage && Boolean(activation.visual),
    hasAuthenticProjectImage: false,
    imageAspectRatio:
      activation.visual?.width && activation.visual.height
        ? activation.visual.width / activation.visual.height
        : null,
    previousFamily,
    previousMode,
  });
  const mediaArea: ResolvedArea | null = variant === "media_left"
    ? {
        x: page.pageArea.x,
        y: page.pageArea.y,
        width: page.pageArea.width * 0.48,
        height: page.pageArea.height,
      }
    : variant === "media_right"
    ? {
        x: page.pageArea.x + page.pageArea.width * 0.52,
        y: page.pageArea.y,
        width: page.pageArea.width * 0.48,
        height: page.pageArea.height,
      }
    : variant === "top_media"
    ? {
        x: page.pageArea.x,
        y: page.pageArea.y,
        width: page.pageArea.width,
        height: page.pageArea.height * 0.45,
      }
    : null;
  const textArea: ResolvedArea = variant === "media_left" && mediaArea
    ? {
        x: page.pageArea.x + page.pageArea.width * 0.55,
        y: page.contentArea.y,
        width:
          page.contentArea.x + page.contentArea.width -
          (page.pageArea.x + page.pageArea.width * 0.55),
        height: page.contentArea.height,
      }
    : variant === "media_right" && mediaArea
    ? {
        x: page.contentArea.x,
        y: page.contentArea.y,
        width: page.pageArea.width * 0.42 - page.contentArea.x,
        height: page.contentArea.height,
      }
    : variant === "top_media" && mediaArea
    ? {
        x: page.contentArea.x,
        y: mediaArea.y + mediaArea.height + gap,
        width: page.contentArea.width,
        height:
          page.contentArea.y + page.contentArea.height -
          (mediaArea.y + mediaArea.height + gap),
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
    artDirection,
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
  previousMode: PDFPageMode | null = null,
  previousFamily: PDFCompositionFamily | null = null
): PreparedNarrativePage | null => {
  const sectionIds = new Set(activation.page.sections.map((section) => section.sectionId));
  const textLength = availableSections
    .filter((section) => sectionIds.has(section.id))
    .reduce(
      (total, section) =>
        total +
        section.title.length +
        section.content.length +
        section.items.reduce(
          (itemTotal, item) => itemTotal + item.name.length + item.description.length,
          0
        ),
      0
    );
  const layout = createNarrativePageLayout(
    activation,
    hasImage,
    pageIndex,
    previousVariant,
    previousMode,
    textLength,
    previousFamily
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
  const bottomRailClearance =
    layout.artDirection.compositionFamily === "typography_manifesto"
      ? spacingTokens.lg + spacingTokens.sm
      : spacingTokens.sm;
  const bottomLimit =
    layout.textArea.y + layout.textArea.height - bottomRailClearance;
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
    const headingRole = layout.artDirection.compositionFamily === "typography_manifesto"
      ? typography.display
      : layout.artDirection.compositionFamily === "structural_interstitial"
      ? emphasized
        ? typography.h1
        : typography.h2
      : emphasized
      ? typography.h1
      : typography.h2;
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
    const pointToMm = 0.352778;
    const titleAscent = titleFontSize * pointToMm * 0.78;
    const titleY = cursorYs[columnIndex] + titleAscent;
    const headingBounds: PDFTextBounds = {
      top: titleY - titleAscent,
      bottom:
        titleY +
        Math.max(0, titleLines.length - 1) * titleLineHeight +
        titleFontSize * pointToMm * 0.24,
    };
    const ruleY = headingBounds.bottom + Math.max(
      spacingTokens.xs,
      PDF_EDITORIAL_TYPE_CONSTRAINTS.headingToRuleClearance
    );
    const contentY =
      ruleY + Math.max(
        spacingTokens.sm,
        PDF_EDITORIAL_TYPE_CONSTRAINTS.ruleToBodyClearance
      ) + contentFontSize * pointToMm * 0.78;
    const contentBottom = contentLines.length > 0
      ? contentY +
        Math.max(0, contentLines.length - 1) * contentLineHeight +
        contentFontSize * pointToMm * 0.24
      : contentY;
    let bottom = contentBottom;
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
      const itemTitleY = bottom + Math.max(
        spacingTokens.sm,
        PDF_EDITORIAL_TYPE_CONSTRAINTS.subsectionSpacing
      );
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
      headingBounds,
      ruleY,
      bodyBounds:
        contentLines.length > 0
          ? { top: contentY - contentFontSize * pointToMm * 0.78, bottom: contentBottom }
          : null,
      items: preparedItems,
      bottom,
    });
    cursorYs[columnIndex] = bottom + Math.max(
      spacing,
      PDF_EDITORIAL_TYPE_CONSTRAINTS.paragraphSpacing
    );
  }

  if (preparedSections.length > 0) {
    const columnXs = [...new Set(preparedSections.map((section) => section.x))];

    const shiftSection = (section: PreparedNarrativeSection, offset: number) => {
      section.titleY += offset;
      section.contentY += offset;
      section.bottom += offset;
      section.headingBounds.top += offset;
      section.headingBounds.bottom += offset;
      section.ruleY += offset;
      if (section.bodyBounds) {
        section.bodyBounds.top += offset;
        section.bodyBounds.bottom += offset;
      }
      section.items.forEach((item) => {
        item.titleY += offset;
        item.descriptionY += offset;
        item.bottom += offset;
      });
    };

    columnXs.forEach((columnX, columnIndex) => {
      const columnSections = preparedSections.filter(
        (section) => section.x === columnX
      );
      if (!layout.mediaArea && columnSections.length > 1) {
        const currentSpan =
          columnSections[columnSections.length - 1].bottom -
          columnSections[0].headingBounds.top;
        const targetSpan = layout.textArea.height * 0.62;
        const extraGap = Math.min(
          60,
          Math.max(0, (targetSpan - currentSpan) / (columnSections.length - 1))
        );
        columnSections.forEach((section, index) => {
          if (index > 0) shiftSection(section, extraGap * index);
        });
      }
      const first = columnSections[0];
      const last = columnSections[columnSections.length - 1];
      const blockHeight = last.bottom - first.headingBounds.top;
      const utilizationRatio = layout.mediaArea
        ? 0.42
        : layout.textColumns === 2
        ? 0.22 + columnIndex * 0.12
        : columnSections.length > 1
        ? 0.18
        : 0.38;
      const preferredTop =
        layout.textArea.y +
        Math.max(spacingTokens.xl, (layout.textArea.height - blockHeight) * utilizationRatio);
      const latestTop = bottomLimit - blockHeight;
      const offset = Math.max(
        0,
        Math.min(preferredTop, latestTop) - first.headingBounds.top
      );

      columnSections.forEach((section) => {
        shiftSection(section, offset);
      });
    });
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
    if (layout.artDirection.compositionFamily === "structural_interstitial") {
      pdf.setFillColor(palette.accent[0], palette.accent[1], palette.accent[2]);
      pdf.rect(0, 0, spacing.lg, layout.pageArea.height, "F");
    }
  }

  if (layout.artDirection.compositionFamily === "architectural_split") {
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
  }

  prepared.sections.forEach((section) => {
    pdf.setTextColor(
      palette.primaryText[0],
      palette.primaryText[1],
      palette.primaryText[2]
    );
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(section.titleFontSize);
    pdf.setLineHeightFactor(
      section.titleLineHeight / (section.titleFontSize * 0.352778)
    );
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
        section.ruleY,
        section.x + Math.min(
          designTokens.rules.shortRuleWidth,
          layout.textArea.width
        ),
        section.ruleY
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
      pdf.setLineHeightFactor(
        section.contentLineHeight / (section.contentFontSize * 0.352778)
      );
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
      pdf.setLineHeightFactor(getPDFLineHeightFactor(typography.h3));
      pdf.text(item.titleLines, section.x, item.titleY);

      if (item.descriptionLines.length > 0) {
        pdf.setTextColor(
          palette.secondaryText[0],
          palette.secondaryText[1],
          palette.secondaryText[2]
        );
        pdf.setFont("helvetica", typography.caption.fontStyle);
        pdf.setFontSize(typography.caption.fontSize);
        pdf.setLineHeightFactor(getPDFLineHeightFactor(typography.caption));
        pdf.text(item.descriptionLines, section.x, item.descriptionY);
      }
    });
  });

  return {
    consumedSectionIds: [...prepared.consumedSectionIds],
    renderedVisual: imageSource && layout.mediaArea ? activation.visual : null,
  };
};
