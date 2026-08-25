import type jsPDF from "jspdf";
import type {
  ResolvedArea,
  ResolvedCompositionPage,
} from "./composition-resolver";
import type { SelectedContextualVisual } from "./types";
import type { CoverEditorialBrandColor } from "./pdf-cover-editorial";

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
  mediaArea: ResolvedArea;
  textArea: ResolvedArea;
  mode: "image" | "image_free";
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
  brandColor: CoverEditorialBrandColor;
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
  hasImage: boolean
): NarrativePageLayout | null => {
  const { page } = activation;
  const gap = page.densityParameters.sectionGap;
  const mediaArea: ResolvedArea = page.archetype === "narrative_split"
    ? {
        x: page.contentArea.x,
        y: page.contentArea.y,
        width: page.sectionArea.x - gap - page.contentArea.x,
        height: page.contentArea.height,
      }
    : {
        x: page.contentArea.x,
        y: page.contentArea.y,
        width: page.contentArea.width,
        height: page.sectionArea.y - gap - page.contentArea.y,
      };
  const textArea = { ...page.sectionArea };
  const areas = [page.pageArea, page.contentArea, mediaArea, textArea];

  if (!areas.every((area) => isWithinPage(area, page.pageArea))) {
    return null;
  }

  return {
    pageArea: { ...page.pageArea },
    contentArea: { ...page.contentArea },
    mediaArea,
    textArea,
    mode: hasImage ? "image" : "image_free",
  };
};

export const prepareNarrativePage = (
  pdf: jsPDF,
  activation: NarrativePageActivation,
  availableSections: readonly NarrativeContentSection[],
  hasImage: boolean
): PreparedNarrativePage | null => {
  const layout = createNarrativePageLayout(activation, hasImage);

  if (!layout) {
    return null;
  }

  const sectionsById = new Map(
    availableSections.map((section) => [section.id, section])
  );
  const spacing =
    activation.page.densityParameters.sectionGap *
    activation.page.densityParameters.spacingMultiplier;
  const rightInset = 3;
  const textWidth = layout.textArea.width - rightInset;
  const bottomLimit = layout.textArea.y + layout.textArea.height - 6;
  let cursorY = layout.textArea.y + 18;
  const preparedSections: PreparedNarrativeSection[] = [];

  for (const reference of activation.page.sections) {
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
    const titleFontSize = emphasized ? 21 : 14;
    const titleLineHeight = emphasized ? 8.2 : 6.2;
    const contentFontSize = emphasized ? 11.2 : 10;
    const contentLineHeight = emphasized ? 6.2 : 5.5;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(titleFontSize);
    const titleLines = pdf.splitTextToSize(
      section.title.trim(),
      textWidth
    ) as string[];
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(contentFontSize);
    const contentLines = section.content.trim()
      ? (pdf.splitTextToSize(section.content.trim(), textWidth) as string[])
      : [];
    const titleY = cursorY;
    const contentY = titleY + titleLines.length * titleLineHeight + 5;
    let bottom = contentY + contentLines.length * contentLineHeight;
    const preparedItems: PreparedNarrativeItem[] = [];

    for (const item of section.items) {
      if (!item.name.trim()) {
        return null;
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.5);
      const itemTitleLines = pdf.splitTextToSize(
        item.name.trim(),
        textWidth
      ) as string[];
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.3);
      const itemDescriptionLines = item.description.trim()
        ? (pdf.splitTextToSize(item.description.trim(), textWidth) as string[])
        : [];
      const itemTitleY = bottom + 5;
      const itemDescriptionY = itemTitleY + itemTitleLines.length * 5 + 2;
      const itemBottom =
        itemDescriptionY + itemDescriptionLines.length * 4.8;

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
      x: layout.textArea.x,
      titleY,
      contentY,
      titleFontSize,
      titleLineHeight,
      contentFontSize,
      contentLineHeight,
      items: preparedItems,
      bottom,
    });
    cursorY = bottom + spacing;
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
  brandColor,
  imageSource,
}: DrawNarrativePageInput): {
  consumedSectionIds: string[];
  renderedVisual: SelectedContextualVisual | null;
} => {
  if (!companyName.trim() || prepared.sections.length === 0) {
    throw new Error("Narrative page data is incomplete.");
  }

  const { layout, activation } = prepared;
  pdf.setFillColor(250, 249, 246);
  pdf.rect(
    layout.pageArea.x,
    layout.pageArea.y,
    layout.pageArea.width,
    layout.pageArea.height,
    "F"
  );

  if (imageSource && activation.visual) {
    pdf.addImage(
      imageSource,
      "JPEG",
      layout.mediaArea.x,
      layout.mediaArea.y,
      layout.mediaArea.width,
      layout.mediaArea.height
    );
  } else {
    pdf.setFillColor(235, 232, 224);
    pdf.rect(
      layout.mediaArea.x,
      layout.mediaArea.y,
      layout.mediaArea.width,
      layout.mediaArea.height,
      "F"
    );
    pdf.setDrawColor(
      brandColor.rgb[0],
      brandColor.rgb[1],
      brandColor.rgb[2]
    );
    pdf.setLineWidth(1.1);
    if (activation.page.archetype === "narrative_split") {
      pdf.line(
        layout.mediaArea.x + 10,
        layout.mediaArea.y + 16,
        layout.mediaArea.x + 10,
        layout.mediaArea.y + layout.mediaArea.height - 16
      );
    } else {
      pdf.line(
        layout.mediaArea.x + 12,
        layout.mediaArea.y + layout.mediaArea.height - 12,
        layout.mediaArea.x + layout.mediaArea.width - 12,
        layout.mediaArea.y + layout.mediaArea.height - 12
      );
    }
  }

  pdf.setTextColor(107, 114, 128);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text(
    activation.page.pageRole.toUpperCase(),
    layout.textArea.x,
    layout.textArea.y + 4
  );

  prepared.sections.forEach((section) => {
    pdf.setTextColor(17, 24, 39);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(section.titleFontSize);
    pdf.text(section.titleLines, section.x, section.titleY);

    if (section.emphasized) {
      pdf.setDrawColor(
        brandColor.rgb[0],
        brandColor.rgb[1],
        brandColor.rgb[2]
      );
      pdf.setLineWidth(0.8);
      pdf.line(
        section.x,
        section.contentY - 2.5,
        section.x + Math.min(24, layout.textArea.width),
        section.contentY - 2.5
      );
    }

    if (section.contentLines.length > 0) {
      pdf.setTextColor(55, 65, 81);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(section.contentFontSize);
      pdf.text(section.contentLines, section.x, section.contentY);
    }

    section.items.forEach((item) => {
      pdf.setTextColor(17, 24, 39);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.5);
      pdf.text(item.titleLines, section.x, item.titleY);

      if (item.descriptionLines.length > 0) {
        pdf.setTextColor(75, 85, 99);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.3);
        pdf.text(item.descriptionLines, section.x, item.descriptionY);
      }
    });
  });

  return {
    consumedSectionIds: [...prepared.consumedSectionIds],
    renderedVisual: imageSource ? activation.visual : null,
  };
};
