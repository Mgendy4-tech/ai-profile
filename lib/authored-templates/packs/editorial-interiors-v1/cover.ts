import type { jsPDF } from "jspdf";
import { evaluateContentEnvelope } from "../../content-envelope";
import type {
  AuthoredPageTemplate,
  ContentEnvelope,
  TemplateInstance,
  TemplateRenderAudit,
} from "../../types";
import type { CoverContent } from "./content";
import {
  clipAndDrawImage,
  createEditorialInteriorsMeasurementContext,
  editorialInteriorsV1VisualSystem as visual,
  getPreparedImage,
  getPreparedText,
  paintPaper,
} from "./visual-system";

export const coverEnvelope: ContentEnvelope = {
  slots: [
    {
      id: "documentLabel",
      path: "documentLabel",
      kind: "text",
      required: true,
      fontFamily: visual.fonts.eyebrow.family,
      fontStyle: visual.fonts.eyebrow.style,
      fontSize: visual.fonts.eyebrow.size,
      widthMm: 59,
      maxLines: 1,
    },
    {
      id: "companyName",
      path: "companyName",
      kind: "text",
      required: true,
      fontFamily: visual.fonts.coverTitle.family,
      fontStyle: visual.fonts.coverTitle.style,
      fontSize: visual.fonts.coverTitle.size,
      widthMm: 59,
      maxLines: 3,
    },
    {
      id: "hero",
      path: "hero",
      kind: "image",
      required: true,
      allowedRoles: ["project_image"],
      allowedProvenances: ["user_upload", "ai_generated_fictional_poc_test_asset"],
      minimumAspectRatio: visual.crops.cover.sourceAspectRange.minimum,
      maximumAspectRatio: visual.crops.cover.sourceAspectRange.maximum,
    },
  ],
};

const prepare = (input: CoverContent) => evaluateContentEnvelope(
  "editorial-interiors-v1.cover",
  coverEnvelope,
  input,
  createEditorialInteriorsMeasurementContext(),
  [input.contentId],
);

const render = (
  pdf: jsPDF,
  instance: TemplateInstance<CoverContent>,
): TemplateRenderAudit => {
  paintPaper(pdf);
  const hero = getPreparedImage(instance, "hero");
  clipAndDrawImage(pdf, hero.source.source, hero.source.format, visual.crops.cover.frame, visual.crops.cover.image);

  const documentLabel = getPreparedText(instance, "documentLabel");
  pdf.setTextColor(...visual.palette.secondary);
  pdf.setFont(visual.fonts.eyebrow.family, visual.fonts.eyebrow.style);
  pdf.setFontSize(visual.fonts.eyebrow.size);
  pdf.setCharSpace(0.55);
  pdf.text([...documentLabel.lines], 139, 47);
  pdf.setCharSpace(0);
  pdf.setDrawColor(...visual.palette.ochre);
  pdf.setLineWidth(visual.rule.lineWidth);
  pdf.line(139, 58, 153, 58);

  pdf.setTextColor(...visual.palette.charcoal);
  pdf.setFont(visual.fonts.coverTitle.family, visual.fonts.coverTitle.style);
  pdf.setFontSize(visual.fonts.coverTitle.size);
  const baselines = [99, 116, 133] as const;
  const renderedTextBySlot: Record<string, readonly string[]> = {
    documentLabel: documentLabel.lines,
  };
  const companyName = getPreparedText(instance, "companyName");
  companyName.lines.forEach((line, index) => pdf.text(line, 139, baselines[index]));
  renderedTextBySlot.companyName = companyName.lines;

  return { templateId: instance.templateId, renderedTextBySlot };
};

export const editorialInteriorsCoverTemplate: AuthoredPageTemplate<CoverContent> = {
  id: "editorial-interiors-v1.cover",
  pageRole: "cover",
  family: "editorial_cover",
  priority: 100,
  envelope: coverEnvelope,
  prepare,
  render,
};
