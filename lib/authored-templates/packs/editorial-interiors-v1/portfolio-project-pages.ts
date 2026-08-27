import type { jsPDF } from "jspdf";
import { evaluateContentEnvelope } from "../../content-envelope";
import type { AuthoredPageTemplate, ContentEnvelope, ImageSlotValue, TemplateCompatibilityResult, TemplateInstance, TemplateRenderAudit } from "../../types";
import { clipAndDrawImage, createEditorialInteriorsMeasurementContext, editorialInteriorsV1VisualSystem as visual, getPreparedImage, getPreparedText, paintPaper } from "./visual-system";

export type AssociatedProjectImage = ImageSlotValue & { projectId: string };
export type PortfolioProjectContent = { contentId: string; name: string; description: string; image: AssociatedProjectImage };
export type PortfolioProjectPageContent = { contentId: string; projects: readonly PortfolioProjectContent[] };

type Cell = { image: { x: number; y: number; width: number; height: number }; title: { x: number; y: number; width: number }; description: { x: number; y: number; width: number }; titleSize: number; descriptionLines: number };
type FixedDefinition = { id: string; role: "project_grid" | "continuation"; label: string; count: 1 | 2 | 3 | 4; cells: readonly Cell[] };

const coverCrop = (frame: Cell["image"], sourceAspectRatio: number) => {
  const frameAspectRatio = frame.width / frame.height;
  if (sourceAspectRatio >= frameAspectRatio) {
    const width = frame.height * sourceAspectRatio;
    return { x: frame.x - (width - frame.width) / 2, y: frame.y, width, height: frame.height };
  }
  const height = frame.width / sourceAspectRatio;
  return { x: frame.x, y: frame.y - (height - frame.height) / 2, width: frame.width, height };
};

const definitions = {
  projectGrid2: { id: "editorial-interiors-v1.project-grid-2", role: "project_grid", label: "04 / SELECTED WORK", count: 2, cells: [
    { image: { x: 0, y: 0, width: 128, height: 150 }, title: { x: 19, y: 174, width: 102 }, description: { x: 19, y: 190, width: 94 }, titleSize: 21, descriptionLines: 6 },
    { image: { x: 142, y: 28, width: 68, height: 95 }, title: { x: 142, y: 139, width: 49 }, description: { x: 142, y: 151, width: 49 }, titleSize: 14, descriptionLines: 8 },
  ] },
  projectGrid3: { id: "editorial-interiors-v1.project-grid-3", role: "project_grid", label: "04 / SELECTED WORK", count: 3, cells: [
    { image: { x: 0, y: 0, width: 210, height: 126 }, title: { x: 19, y: 147, width: 172 }, description: { x: 19, y: 159, width: 150 }, titleSize: 20, descriptionLines: 3 },
    { image: { x: 19, y: 193, width: 82, height: 58 }, title: { x: 19, y: 266, width: 72 }, description: { x: 19, y: 276, width: 72 }, titleSize: 13, descriptionLines: 3 },
    { image: { x: 109, y: 193, width: 82, height: 58 }, title: { x: 109, y: 266, width: 72 }, description: { x: 109, y: 276, width: 72 }, titleSize: 13, descriptionLines: 3 },
  ] },
  projectGrid4: { id: "editorial-interiors-v1.project-grid-4", role: "project_grid", label: "04 / SELECTED WORK", count: 4, cells: [
    { image: { x: 19, y: 38, width: 82, height: 70 }, title: { x: 19, y: 121, width: 72 }, description: { x: 19, y: 131, width: 72 }, titleSize: 13, descriptionLines: 4 },
    { image: { x: 109, y: 38, width: 82, height: 70 }, title: { x: 109, y: 121, width: 72 }, description: { x: 109, y: 131, width: 72 }, titleSize: 13, descriptionLines: 4 },
    { image: { x: 19, y: 168, width: 82, height: 70 }, title: { x: 19, y: 251, width: 72 }, description: { x: 19, y: 261, width: 72 }, titleSize: 13, descriptionLines: 4 },
    { image: { x: 109, y: 168, width: 82, height: 70 }, title: { x: 109, y: 251, width: 72 }, description: { x: 109, y: 261, width: 72 }, titleSize: 13, descriptionLines: 4 },
  ] },
  continuation1: { id: "editorial-interiors-v1.portfolio-continuation-1", role: "continuation", label: "PORTFOLIO / CONTINUED", count: 1, cells: [
    { image: { x: 0, y: 0, width: 130, height: 210 }, title: { x: 145, y: 104, width: 46 }, description: { x: 145, y: 120, width: 46 }, titleSize: 17, descriptionLines: 12 },
  ] },
  continuation2: { id: "editorial-interiors-v1.portfolio-continuation-2", role: "continuation", label: "PORTFOLIO / CONTINUED", count: 2, cells: [
    { image: { x: 0, y: 0, width: 122, height: 145 }, title: { x: 19, y: 166, width: 94 }, description: { x: 19, y: 180, width: 94 }, titleSize: 18, descriptionLines: 6 },
    { image: { x: 130, y: 152, width: 80, height: 100 }, title: { x: 130, y: 268, width: 61 }, description: { x: 130, y: 278, width: 61 }, titleSize: 13, descriptionLines: 3 },
  ] },
  continuation3: { id: "editorial-interiors-v1.portfolio-continuation-3", role: "continuation", label: "PORTFOLIO / CONTINUED", count: 3, cells: [
    { image: { x: 0, y: 0, width: 120, height: 150 }, title: { x: 19, y: 170, width: 92 }, description: { x: 19, y: 184, width: 92 }, titleSize: 18, descriptionLines: 6 },
    { image: { x: 130, y: 28, width: 80, height: 82 }, title: { x: 130, y: 124, width: 61 }, description: { x: 130, y: 134, width: 61 }, titleSize: 12, descriptionLines: 4 },
    { image: { x: 110, y: 190, width: 100, height: 70 }, title: { x: 110, y: 274, width: 81 }, description: { x: 110, y: 284, width: 81 }, titleSize: 12, descriptionLines: 2 },
  ] },
  continuation4: { id: "editorial-interiors-v1.portfolio-continuation-4", role: "continuation", label: "PORTFOLIO / CONTINUED", count: 4, cells: [
    { image: { x: 0, y: 0, width: 104, height: 116 }, title: { x: 19, y: 134, width: 76 }, description: { x: 19, y: 144, width: 76 }, titleSize: 12, descriptionLines: 4 },
    { image: { x: 112, y: 28, width: 98, height: 88 }, title: { x: 112, y: 134, width: 79 }, description: { x: 112, y: 144, width: 79 }, titleSize: 12, descriptionLines: 4 },
    { image: { x: 0, y: 169, width: 104, height: 92 }, title: { x: 19, y: 272, width: 76 }, description: { x: 19, y: 282, width: 76 }, titleSize: 12, descriptionLines: 2 },
    { image: { x: 112, y: 169, width: 98, height: 92 }, title: { x: 112, y: 272, width: 79 }, description: { x: 112, y: 282, width: 79 }, titleSize: 12, descriptionLines: 2 },
  ] },
} as const satisfies Record<string, FixedDefinition>;

const TITLE_MAX_LINES = 2;
const TITLE_LINE_HEIGHT_FACTOR = 1.08;
const DESCRIPTION_FONT_SIZE = 8;
const titleDescriptionClearance = (cell: Cell) => cell.description.y - (cell.title.y + (TITLE_MAX_LINES - 1) * cell.titleSize * 0.352778 * TITLE_LINE_HEIGHT_FACTOR + cell.titleSize * 0.352778 * 0.25 + DESCRIPTION_FONT_SIZE * 0.352778 * 0.75);
export const editorialInteriorsProjectTextGeometry = Object.fromEntries(Object.values(definitions).map((definition) => [definition.id, definition.cells.map((cell) => ({ title: cell.title, description: cell.description, titleSize: cell.titleSize, titleMaxLines: TITLE_MAX_LINES, titleLineHeightFactor: TITLE_LINE_HEIGHT_FACTOR, descriptionFontSize: DESCRIPTION_FONT_SIZE, descriptionMaxLines: cell.descriptionLines, clearanceMm: titleDescriptionClearance(cell) }))]));

const envelopeFor = (definition: FixedDefinition): ContentEnvelope => ({ slots: [
  { id: "projects", path: "projects", kind: "collection", required: true, minItems: definition.count, maxItems: definition.count },
  ...definition.cells.flatMap((cell, index) => [
    { id: `project${index}Name`, path: `projects.${index}.name`, kind: "text" as const, required: true, fontFamily: "times", fontStyle: "bold" as const, fontSize: cell.titleSize, widthMm: cell.title.width, maxLines: TITLE_MAX_LINES },
    { id: `project${index}Description`, path: `projects.${index}.description`, kind: "text" as const, required: true, fontFamily: "helvetica", fontStyle: "normal" as const, fontSize: DESCRIPTION_FONT_SIZE, widthMm: cell.description.width, maxLines: cell.descriptionLines },
    { id: `project${index}Image`, path: `projects.${index}.image`, kind: "image" as const, required: true, allowedRoles: ["project_image"] as const, allowedProvenances: ["user_upload"] as const, minimumAspectRatio: 0.5, maximumAspectRatio: 2 },
  ]),
] });

const templateFor = (definition: FixedDefinition): AuthoredPageTemplate<PortfolioProjectPageContent> => {
  const envelope = envelopeFor(definition);
  const prepare = (input: PortfolioProjectPageContent): TemplateCompatibilityResult<PortfolioProjectPageContent> => {
    const result = evaluateContentEnvelope(definition.id, envelope, input, createEditorialInteriorsMeasurementContext(), input.projects.map((project) => project.contentId));
    if (!result.compatible) return result;
    const mismatch = input.projects.findIndex((project) => project.image.projectId !== project.contentId);
    if (mismatch >= 0) return { compatible: false, instance: null, issues: [{ code: "image_project_association_mismatch", path: `projects.${mismatch}.image.projectId`, slotId: `project${mismatch}Image`, message: "Project image association must match its project content ID." }] };
    return result;
  };
  const render = (pdf: jsPDF, instance: TemplateInstance<PortfolioProjectPageContent>): TemplateRenderAudit => {
    paintPaper(pdf);
    const renderedTextBySlot: Record<string, readonly string[]> = {};
    pdf.setTextColor(...visual.palette.secondary); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setCharSpace(0.7); pdf.text(definition.label, 19, 24); pdf.setCharSpace(0);
    pdf.setDrawColor(...visual.palette.ochre); pdf.setLineWidth(visual.rule.lineWidth); pdf.line(19, 30, 42, 30);
    definition.cells.forEach((cell, index) => {
      const image = getPreparedImage(instance, `project${index}Image`);
      clipAndDrawImage(pdf, image.source.source, image.source.format, cell.image, coverCrop(cell.image, image.aspectRatio));
      const title = getPreparedText(instance, `project${index}Name`); const description = getPreparedText(instance, `project${index}Description`);
      pdf.setTextColor(...visual.palette.charcoal); pdf.setFont("times", "bold"); pdf.setFontSize(cell.titleSize); pdf.setLineHeightFactor(TITLE_LINE_HEIGHT_FACTOR); pdf.text([...title.lines], cell.title.x, cell.title.y); renderedTextBySlot[`project${index}Name`] = title.lines;
      pdf.setTextColor(...visual.palette.secondary); pdf.setFont("helvetica", "normal"); pdf.setFontSize(DESCRIPTION_FONT_SIZE); pdf.setLineHeightFactor(1.35); pdf.text([...description.lines], cell.description.x, cell.description.y); renderedTextBySlot[`project${index}Description`] = description.lines;
    });
    return { templateId: definition.id, renderedTextBySlot };
  };
  return { id: definition.id, pageRole: definition.role, family: "editorial_project_feature", priority: 90, envelope, prepare, render };
};

export const editorialInteriorsProjectGrid2Template = templateFor(definitions.projectGrid2);
export const editorialInteriorsProjectGrid3Template = templateFor(definitions.projectGrid3);
export const editorialInteriorsProjectGrid4Template = templateFor(definitions.projectGrid4);
export const editorialInteriorsPortfolioContinuation1Template = templateFor(definitions.continuation1);
export const editorialInteriorsPortfolioContinuation2Template = templateFor(definitions.continuation2);
export const editorialInteriorsPortfolioContinuation3Template = templateFor(definitions.continuation3);
export const editorialInteriorsPortfolioContinuation4Template = templateFor(definitions.continuation4);

export const editorialInteriorsMultiProjectTemplates = [editorialInteriorsProjectGrid2Template, editorialInteriorsProjectGrid3Template, editorialInteriorsProjectGrid4Template, editorialInteriorsPortfolioContinuation1Template, editorialInteriorsPortfolioContinuation2Template, editorialInteriorsPortfolioContinuation3Template, editorialInteriorsPortfolioContinuation4Template] as const;
