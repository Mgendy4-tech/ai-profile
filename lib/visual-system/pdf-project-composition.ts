import type jsPDF from "jspdf";
import type { ResolvedArea, ResolvedCompositionPage } from "./composition-resolver";
import {
  resolvePagePalette,
  resolveSpacingForDensity,
  resolveTypographyForDensity,
  type PDFDesignTokens,
  type PDFPageMode,
} from "./pdf-design-tokens";
import { resolvePDFPageMode } from "./pdf-page-pacing";

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
  previousMode: PDFPageMode | null
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
  const pageMode = resolvePDFPageMode({
    pageIndex,
    pageRole: "projects",
    density: activation.page.density,
    hasImage,
    previousMode,
  });
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
        x: content.x,
        y: content.y + spacing.lg,
        width: content.width,
        height: content.height * 0.58,
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
              x: content.x,
              y: content.y + spacing.lg,
              width: content.width * 0.6,
              height: content.height * 0.52,
            }
          : null;
        captionX = content.x;
        captionWidth = content.width * 0.6;
        captionY = imageArea
          ? imageArea.y + imageArea.height + spacing.md
          : content.y + content.height * 0.3;
      } else {
        dominant = false;
        imageArea = project.image
          ? {
              x: content.x + content.width * 0.66,
              y: content.y + content.height * 0.2,
              width: content.width * 0.34,
              height: content.height * 0.34,
            }
          : null;
        captionX = content.x + content.width * 0.66;
        captionWidth = content.width * 0.34;
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
    const titleLines = pdf.splitTextToSize(project.name, captionWidth) as string[];
    pdf.setFont("helvetica", typography.caption.fontStyle);
    pdf.setFontSize(typography.caption.fontSize);
    const descriptionLines = project.description.trim()
      ? (pdf.splitTextToSize(project.description.trim(), captionWidth) as string[])
      : [];
    const descriptionY = captionY + titleLines.length * heading.lineHeight + spacing.xs;
    const bottom = descriptionY + descriptionLines.length * typography.caption.lineHeight;

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
      project.descriptionY - spacing.xs,
      project.titleX + Math.min(designTokens.rules.shortRuleWidth, project.captionWidth),
      project.descriptionY - spacing.xs
    );

    if (project.descriptionLines.length > 0) {
      pdf.setTextColor(
        palette.secondaryText[0],
        palette.secondaryText[1],
        palette.secondaryText[2]
      );
      pdf.setFont("helvetica", typography.caption.fontStyle);
      pdf.setFontSize(typography.caption.fontSize);
      pdf.text(project.descriptionLines, project.titleX, project.descriptionY);
    }
  });

  return { consumedSectionIds: [...prepared.consumedSectionIds] };
};
