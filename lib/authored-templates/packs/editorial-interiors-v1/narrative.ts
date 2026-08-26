import type { jsPDF } from "jspdf";
import { evaluateContentEnvelope } from "../../content-envelope";
import type { AuthoredPageTemplate, ContentEnvelope, TemplateInstance, TemplateRenderAudit } from "../../types";
import type { NarrativeContent } from "./content";
import {
  createEditorialInteriorsMeasurementContext,
  editorialInteriorsV1VisualSystem as visual,
  getPreparedText,
  paintPaper,
} from "./visual-system";

const singleLine = (
  id: string,
  path: string,
  font: { family: string; style: "normal" | "bold" | "italic" | "bolditalic"; size: number },
  widthMm: number,
) => ({
  id,
  path,
  kind: "text" as const,
  required: true,
  fontFamily: font.family,
  fontStyle: font.style,
  fontSize: font.size,
  widthMm,
  maxLines: 1,
});

export const narrativeEnvelope: ContentEnvelope = {
  slots: [
    { ...singleLine("title", "title", visual.fonts.display, 172), maxLines: 2 },
    { ...singleLine("callout", "callout.text", visual.fonts.displayItalic, 53), maxLines: 4, required: false },
    {
      ...singleLine("calloutLabel", "callout.label", { family: "helvetica", style: "bold", size: 7 }, 53),
      maxLines: 2,
      required: false,
    },
    { id: "body", path: "body", kind: "text", required: true, fontFamily: "helvetica", fontStyle: "normal", fontSize: 10, widthMm: 103, maxLines: 8 },
    { ...singleLine("secondaryTitle", "secondaryBlock.title", { family: "times", style: "bold", size: 13 }, 103), required: false },
    { id: "secondaryBody", path: "secondaryBlock.body", kind: "text", required: false, fontFamily: "helvetica", fontStyle: "normal", fontSize: 10, widthMm: 103, maxLines: 8 },
  ],
};

const prepare = (input: NarrativeContent) => evaluateContentEnvelope(
  "editorial-interiors-v1.narrative",
  narrativeEnvelope,
  input,
  createEditorialInteriorsMeasurementContext(),
  [input.contentId],
);

const render = (
  pdf: jsPDF,
  instance: TemplateInstance<NarrativeContent>,
): TemplateRenderAudit => {
  paintPaper(pdf);
  const renderedTextBySlot: Record<string, readonly string[]> = {};
  const draw = (slotId: string, x: number, y: number) => {
    const prepared = getPreparedText(instance, slotId);
    pdf.text([...prepared.lines], x, y);
    renderedTextBySlot[slotId] = prepared.lines;
  };

  pdf.setTextColor(...visual.palette.charcoal);
  pdf.setFont("times", "normal");
  pdf.setFontSize(34);
  pdf.setLineHeightFactor(12 / (34 * 0.352778));
  draw("title", 19, 53);
  pdf.setDrawColor(...visual.palette.ochre);
  pdf.setLineWidth(visual.rule.lineWidth);
  pdf.line(19, 86, 42, 86);
  pdf.setTextColor(...visual.palette.charcoal);
  pdf.setFont("times", "italic");
  pdf.setFontSize(19);
  pdf.setLineHeightFactor(8 / (19 * 0.352778));
  if (instance.preparedSlots.callout) draw("callout", 19, 109);
  if (instance.preparedSlots.calloutLabel) {
    pdf.setTextColor(...visual.palette.secondary);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    draw("calloutLabel", 19, 151);
  }

  pdf.setTextColor(...visual.palette.secondary);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setLineHeightFactor(1.48);
  draw("body", 88, 104);
  if (instance.preparedSlots.secondaryTitle) {
    pdf.setTextColor(...visual.palette.charcoal);
    pdf.setFont("times", "bold");
    pdf.setFontSize(13);
    draw("secondaryTitle", 88, 171);
  }
  if (instance.preparedSlots.secondaryBody) {
    pdf.setTextColor(...visual.palette.secondary);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setLineHeightFactor(1.48);
    draw("secondaryBody", 88, instance.preparedSlots.secondaryTitle ? 182 : 171);
  }

  return { templateId: instance.templateId, renderedTextBySlot };
};

export const editorialInteriorsNarrativeTemplate: AuthoredPageTemplate<NarrativeContent> = {
  id: "editorial-interiors-v1.narrative",
  pageRole: "narrative",
  family: "editorial_narrative",
  priority: 100,
  envelope: narrativeEnvelope,
  prepare,
  render,
};
