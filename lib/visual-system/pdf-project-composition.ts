import type jsPDF from "jspdf";
import type { ResolvedArea, ResolvedCompositionPage } from "./composition-resolver";
import {
  resolvePagePalette,
  getPDFLineHeightFactor,
  resolveSpacingForDensity,
  resolveTypographyForDensity,
  type PDFDesignTokens,
  type PDFPageMode,
} from "./pdf-design-tokens";
import {
  resolvePDFArtDirection,
  type PDFArtDirection,
  type PDFCompositionFamily,
} from "./pdf-art-direction";
import { PDF_EDITORIAL_TYPE_CONSTRAINTS } from "./pdf-editorial-typesetting";

export type AuthenticProjectImage = {
  role: "project_image";
  provenance: "user_upload";
  source: string;
  width: number;
  height: number;
};

export type ProjectPortfolioItem = {
  name: string;
  description: string;
  image: AuthenticProjectImage | null;
};

export type ProjectPageActivation = {
  page: ResolvedCompositionPage;
  sectionId: string;
  projectNames: string[];
  treatment: "project_grid" | "project_feature";
};

export type ProjectCompositionVariant =
  | "asymmetric_two_project"
  | "editorial_grid"
  | "image_feature"
  | "typographic_feature";

export type PreparedProjectItem = {
  name: string;
  description: string;
  image: AuthenticProjectImage | null;
  imageArea: ResolvedArea | null;
  titleLines: string[];
  descriptionLines: string[];
  titleX: number;
  titleY: number;
  descriptionY: number;
  captionWidth: number;
  dominant: boolean;
  bottom: number;
  headingBounds: { top: number; bottom: number };
  ruleY: number;
  descriptionBounds: { top: number; bottom: number } | null;
  descriptionFontSize: number;
  descriptionLineHeight: number;
};

export type PreparedProjectPage = {
  activation: ProjectPageActivation;
  variant: ProjectCompositionVariant;
  pageMode: PDFPageMode;
  pageArea: ResolvedArea;
  contentArea: ResolvedArea;
  projects: PreparedProjectItem[];
  consumedSectionIds: string[];
  usesContextualStock: false;
  usesRoundedCards: false;
  artDirection: PDFArtDirection;
};

const isWithinA4 = (area: ResolvedArea, page: ResolvedArea) =>
  area.x >= page.x &&
  area.y >= page.y &&
  area.width > 0 &&
  area.height > 0 &&
  area.x + area.width <= page.x + page.width &&
  area.y + area.height <= page.y + page.height;

export const getProjectPageActivation = (
  page: ResolvedCompositionPage
): ProjectPageActivation | null => {
  if (
    page.pageRole !== "projects" ||
    page.projectImagePolicy !== "authentic_project_images_only" ||
    page.visualAssignments.length > 0 ||
    (page.archetype !== "project_grid" && page.archetype !== "project_feature") ||
    page.sections.length !== 1
  ) {
    return null;
  }

  const section = page.sections[0];

  if (
    (section.treatment !== "project_grid" &&
      section.treatment !== "project_feature") ||
    section.treatment !== page.archetype ||
    section.projectNames.length === 0 ||
    (section.treatment === "project_feature" && section.projectNames.length !== 1)
  ) {
    return null;
  }

  return {
    page,
    sectionId: section.sectionId,
    projectNames: [...section.projectNames],
    treatment: section.treatment,
  };
};

const selectProjectVariant = (
  activation: ProjectPageActivation,
  projects: readonly ProjectPortfolioItem[]
): ProjectCompositionVariant => {
  if (activation.treatment === "project_feature") {
    return projects[0]?.image ? "image_feature" : "typographic_feature";
  }

  return projects.length === 2
    ? "asymmetric_two_project"
    : "editorial_grid";
};

export const prepareProjectPage = (
  pdf: jsPDF,
  activation: ProjectPageActivation,
  availableProjects: readonly ProjectPortfolioItem[],
  designTokens: PDFDesignTokens,
  pageIndex: number,
  previousMode: PDFPageMode | null,
  previousFamily: PDFCompositionFamily | null = null
): PreparedProjectPage | null => {
  const byName = new Map(availableProjects.map((project) => [project.name, project]));
  const projects = activation.projectNames.map((name) => byName.get(name));

  if (
    projects.some((project) => !project) ||
    new Set(activation.projectNames).size !== activation.projectNames.length
  ) {
    return null;
  }

  const safeProjects = projects as ProjectPortfolioItem[];
  if (
    safeProjects.some(
      (project) =>
        !project.name.trim() ||
        (project.image &&
          (project.image.role !== "project_image" ||
            project.image.provenance !== "user_upload" ||
            !project.image.source ||
            project.image.width <= 0 ||
            project.image.height <= 0))
    )
  ) {
    return null;
  }

  const variant = selectProjectVariant(activation, safeProjects);
  const hasImage = safeProjects.some((project) => Boolean(project.image));
  const artDirection = resolvePDFArtDirection({
    pageIndex,
    pageRole: "projects",
    archetype: activation.page.archetype,
    density: activation.page.density,
    sectionCount: 1,
    textLength: safeProjects.reduce(
      (total, project) => total + project.name.length + project.description.length,
      0
    ),
    hasContextualImage: false,
    hasAuthenticProjectImage: hasImage,
    imageAspectRatio: null,
    previousFamily,
    previousMode,
  });
  const pageMode = artDirection.pageMode;
  const typography = resolveTypographyForDensity(
    designTokens,
    activation.page.density
  );
  const spacing = resolveSpacingForDensity(designTokens, activation.page.density);
  const content = activation.page.contentArea;
  const prepared: PreparedProjectItem[] = [];

  safeProjects.forEach((project, index) => {
    let imageArea: ResolvedArea | null = null;
    let captionX = content.x;
    let captionY = content.y + 80;
    let captionWidth = content.width;
    let dominant = index === 0;

    if (variant === "image_feature") {
      imageArea = {
        x: 0,
        y: 0,
        width: activation.page.pageArea.width,
        height: activation.page.pageArea.height * 0.55,
      };
      captionY = imageArea.y + imageArea.height + spacing.lg;
    } else if (variant === "typographic_feature") {
      captionX = content.x + content.width * 0.16;
      captionWidth = content.width * 0.68;
      captionY = content.y + content.height * 0.36;
    } else if (variant === "asymmetric_two_project") {
      if (index === 0) {
        imageArea = project.image
          ? {
              x: 0,
              y: 0,
              width: activation.page.pageArea.width * 0.62,
              height: activation.page.pageArea.height * 0.56,
            }
          : null;
        captionX = content.x;
        captionWidth = content.width * 0.58;
        captionY = imageArea
          ? imageArea.y + imageArea.height + spacing.md
          : content.y + content.height * 0.3;
      } else {
        dominant = false;
        imageArea = project.image
          ? {
              x: content.x + content.width * 0.64,
              y: content.y + content.height * 0.17,
              width: content.width * 0.36,
              height: content.height * 0.3,
            }
          : null;
        captionX = content.x + content.width * 0.64;
        captionWidth = content.width * 0.36;
        captionY = imageArea
          ? imageArea.y + imageArea.height + spacing.md
          : content.y + content.height * 0.52;
      }
    } else {
      const columnWidth = (content.width - spacing.md) / 2;
      const column = index % 2;
      const row = Math.floor(index / 2);
      captionX = content.x + column * (columnWidth + spacing.md);
      captionWidth = columnWidth;
      const rowTop = content.y + spacing.lg + row * (content.height * 0.46);
      imageArea = project.image
        ? {
            x: captionX,
            y: rowTop,
            width: columnWidth,
            height: content.height * 0.28,
          }
        : null;
      captionY = imageArea ? imageArea.y + imageArea.height + spacing.sm : rowTop;
      dominant = index === 0;
    }

    const heading = dominant ? typography.h1 : typography.h2;
    pdf.setFont("helvetica", heading.fontStyle);
    pdf.setFontSize(heading.fontSize);
    pdf.setLineHeightFactor(getPDFLineHeightFactor(heading));
    const titleLines = pdf.splitTextToSize(project.name, captionWidth) as string[];
    const descriptionFontSize = Math.max(
      typography.body.fontSize,
      PDF_EDITORIAL_TYPE_CONSTRAINTS.minimumProjectDescriptionFontSize
    );
    const descriptionLineHeight = Math.max(typography.body.lineHeight, 5.2);
    pdf.setFont("helvetica", typography.body.fontStyle);
    pdf.setFontSize(descriptionFontSize);
    const descriptionLines = project.description.trim()
      ? (pdf.splitTextToSize(project.description.trim(), captionWidth) as string[])
      : [];
    const pointToMm = 0.352778;
    const headingBounds = {
      top: captionY - heading.fontSize * pointToMm * 0.78,
      bottom:
        captionY +
        Math.max(0, titleLines.length - 1) * heading.lineHeight +
        heading.fontSize * pointToMm * 0.24,
    };
    const ruleY = headingBounds.bottom + spacing.xs;
    const descriptionY =
      ruleY + spacing.sm + descriptionFontSize * pointToMm * 0.78;
    const descriptionBottom = descriptionLines.length > 0
      ? descriptionY +
        Math.max(0, descriptionLines.length - 1) * descriptionLineHeight +
        descriptionFontSize * pointToMm * 0.24
      : descriptionY;
    const bottom = descriptionBottom;

    prepared.push({
      name: project.name,
      description: project.description,
      image: project.image,
      imageArea,
      titleLines,
      descriptionLines,
      titleX: captionX,
      titleY: captionY,
      descriptionY,
      captionWidth,
      dominant,
      bottom,
      headingBounds,
      ruleY,
      descriptionBounds:
        descriptionLines.length > 0
          ? {
              top: descriptionY - descriptionFontSize * pointToMm * 0.78,
              bottom: descriptionBottom,
            }
          : null,
      descriptionFontSize,
      descriptionLineHeight,
    });
  });

  const areas = prepared.flatMap((project) =>
    project.imageArea ? [project.imageArea] : []
  );
  const bottomLimit = content.y + content.height;

  if (
    areas.some((area) => !isWithinA4(area, activation.page.pageArea)) ||
    prepared.some((project) => project.bottom > bottomLimit)
  ) {
    return null;
  }

  return {
    activation,
    variant,
    pageMode,
    pageArea: { ...activation.page.pageArea },
    contentArea: { ...content },
    projects: prepared,
    consumedSectionIds: [activation.sectionId],
    usesContextualStock: false,
    usesRoundedCards: false,
    artDirection,
  };
};

const drawContainedImage = (
  pdf: jsPDF,
  image: AuthenticProjectImage,
  area: ResolvedArea
) => {
  const sourceRatio = image.width / image.height;
  const areaRatio = area.width / area.height;
  const width = sourceRatio > areaRatio ? area.width : area.height * sourceRatio;
  const height = sourceRatio > areaRatio ? area.width / sourceRatio : area.height;

  pdf.addImage(
    image.source,
    area.x + (area.width - width) / 2,
    area.y + (area.height - height) / 2,
    width,
    height
  );
};

export const drawProjectPage = (
  pdf: jsPDF,
  prepared: PreparedProjectPage,
  companyName: string,
  designTokens: PDFDesignTokens
): { consumedSectionIds: string[] } => {
  if (!companyName.trim() || prepared.projects.length === 0) {
    throw new Error("Project page data is incomplete.");
  }

  const palette = resolvePagePalette(designTokens, prepared.pageMode);
  const typography = resolveTypographyForDensity(
    designTokens,
    prepared.activation.page.density
  );
  const spacing = resolveSpacingForDensity(
    designTokens,
    prepared.activation.page.density
  );
  pdf.setFillColor(palette.background[0], palette.background[1], palette.background[2]);
  pdf.rect(
    prepared.pageArea.x,
    prepared.pageArea.y,
    prepared.pageArea.width,
    prepared.pageArea.height,
    "F"
  );
  pdf.setTextColor(
    palette.secondaryText[0],
    palette.secondaryText[1],
    palette.secondaryText[2]
  );
  pdf.setFont("helvetica", typography.overline.fontStyle);
  pdf.setFontSize(typography.overline.fontSize);
  pdf.text("SELECTED PROJECTS", prepared.contentArea.x, prepared.contentArea.y);

  prepared.projects.forEach((project) => {
    if (project.image && project.imageArea) {
      drawContainedImage(pdf, project.image, project.imageArea);
    }

    const heading = project.dominant ? typography.h1 : typography.h2;
    pdf.setTextColor(
      palette.primaryText[0],
      palette.primaryText[1],
      palette.primaryText[2]
    );
    pdf.setFont("helvetica", heading.fontStyle);
    pdf.setFontSize(heading.fontSize);
    pdf.text(project.titleLines, project.titleX, project.titleY);
    pdf.setDrawColor(palette.accent[0], palette.accent[1], palette.accent[2]);
    pdf.setLineWidth(designTokens.rules.hairlineWidth);
    pdf.line(
      project.titleX,
      project.ruleY,
      project.titleX + Math.min(designTokens.rules.shortRuleWidth, project.captionWidth),
      project.ruleY
    );

    if (project.descriptionLines.length > 0) {
      pdf.setTextColor(
        palette.secondaryText[0],
        palette.secondaryText[1],
        palette.secondaryText[2]
      );
      pdf.setFont("helvetica", typography.body.fontStyle);
      pdf.setFontSize(project.descriptionFontSize);
      pdf.setLineHeightFactor(
        project.descriptionLineHeight / (project.descriptionFontSize * 0.352778)
      );
      pdf.text(project.descriptionLines, project.titleX, project.descriptionY);
    }
  });

  return { consumedSectionIds: [...prepared.consumedSectionIds] };
};
