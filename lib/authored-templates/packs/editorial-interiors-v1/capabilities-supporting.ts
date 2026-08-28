import type { jsPDF } from "jspdf";
import { evaluateContentEnvelope } from "../../content-envelope";
import type { AuthoredPageTemplate, ContentEnvelope, TemplateInstance, TemplateRenderAudit } from "../../types";
import type { CapabilitiesSupportingContent } from "./content";
import { createEditorialInteriorsMeasurementContext, editorialInteriorsV1VisualSystem as visual, getPreparedText, paintPaper } from "./visual-system";

const envelope: ContentEnvelope = { slots: [
  { id: "heading", path: "heading", kind: "text", required: true, fontFamily: "times", fontStyle: "normal", fontSize: 27, widthMm: 172, maxLines: 1 },
  { id: "capabilities", path: "capabilities", kind: "collection", required: true, minItems: 2, maxItems: 2 },
  ...([0, 1] as const).flatMap((index) => [
    { id: `capability${index}Title`, path: `capabilities.${index}.title`, kind: "text" as const, required: true, fontFamily: "times", fontStyle: "bold" as const, fontSize: 15, widthMm: 70, maxLines: 2 },
    { id: `capability${index}Description`, path: `capabilities.${index}.description`, kind: "text" as const, required: true, fontFamily: "helvetica", fontStyle: "normal" as const, fontSize: 8.8, widthMm: 70, maxLines: 4 },
  ]),
  { id: "detailTitle", path: "detail.title", kind: "text", required: true, fontFamily: "times", fontStyle: "bold", fontSize: 18, widthMm: 108, maxLines: 2 },
  { id: "detailBody", path: "detail.body", kind: "text", required: true, fontFamily: "helvetica", fontStyle: "normal", fontSize: 9, widthMm: 108, maxLines: 7 },
  { id: "featuredProjectTitle", path: "featuredProjectTitle", kind: "text", required: true, fontFamily: "times", fontStyle: "bold", fontSize: 15, widthMm: 52, maxLines: 2 },
] };

const renderText = (pdf: jsPDF, instance: TemplateInstance<CapabilitiesSupportingContent>, slotId: string, x: number, y: number, audit: Record<string, readonly string[]>) => {
  const prepared = getPreparedText(instance, slotId);
  pdf.text([...prepared.lines], x, y);
  audit[slotId] = prepared.lines;
};

export const editorialInteriorsCapabilitiesSupportingTemplate: AuthoredPageTemplate<CapabilitiesSupportingContent> = {
  id: "editorial-interiors-v1.capabilities-supporting-2",
  pageRole: "continuation",
  family: "editorial_capabilities",
  priority: 100,
  envelope,
  prepare: (input) => evaluateContentEnvelope(
    "editorial-interiors-v1.capabilities-supporting-2",
    envelope,
    input,
    createEditorialInteriorsMeasurementContext(),
    [input.capabilities[0].index, input.capabilities[1].index, input.detail.contentId],
  ),
  render: (pdf, instance): TemplateRenderAudit => {
    paintPaper(pdf);
    const audit: Record<string, readonly string[]> = {};
    pdf.setTextColor(...visual.palette.secondary); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setCharSpace(0.7); pdf.text(instance.source.eyebrow, 19, 24); pdf.setCharSpace(0);
    pdf.setDrawColor(...visual.palette.ochre); pdf.setLineWidth(visual.rule.lineWidth); pdf.line(19, 30, 42, 30);
    pdf.setTextColor(...visual.palette.charcoal); pdf.setFont("times", "normal"); pdf.setFontSize(27); renderText(pdf, instance, "heading", 19, 55, audit);
    const origins = [{ x: 19, y: 78 }, { x: 109, y: 78 }] as const;
    origins.forEach(({ x, y }, index) => {
      pdf.setDrawColor(...visual.palette.hairline); pdf.setLineWidth(0.25); pdf.line(x, y, x + 82, y);
      pdf.setTextColor(...visual.palette.ochre); pdf.setFont("times", "normal"); pdf.setFontSize(25); pdf.text(instance.source.capabilities[index].index, x, y + 17);
      pdf.setTextColor(...visual.palette.charcoal); pdf.setFont("times", "bold"); pdf.setFontSize(15); pdf.setLineHeightFactor(1.05); renderText(pdf, instance, `capability${index}Title`, x, y + 31, audit);
      pdf.setTextColor(...visual.palette.secondary); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.8); pdf.setLineHeightFactor(1.4); renderText(pdf, instance, `capability${index}Description`, x, y + 52, audit);
    });
    pdf.setDrawColor(...visual.palette.hairline); pdf.setLineWidth(0.25); pdf.line(19, 163, 191, 163);
    pdf.setTextColor(...visual.palette.ochre); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.text("RESIDENTIAL & COMMERCIAL EXPERTISE", 19, 179);
    pdf.setTextColor(...visual.palette.charcoal); pdf.setFont("times", "bold"); pdf.setFontSize(18); pdf.setLineHeightFactor(1.05); renderText(pdf, instance, "detailTitle", 19, 197, audit);
    pdf.setTextColor(...visual.palette.secondary); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setLineHeightFactor(1.45); renderText(pdf, instance, "detailBody", 19, 220, audit);
    pdf.setFillColor(...visual.palette.charcoal); pdf.rect(136, 181, 55, 70, "F");
    pdf.setTextColor(...visual.palette.ochre); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7); pdf.text("FEATURED PROJECT", 146, 198);
    pdf.setTextColor(...visual.palette.paper); pdf.setFont("times", "bold"); pdf.setFontSize(15); pdf.setLineHeightFactor(1.05); renderText(pdf, instance, "featuredProjectTitle", 146, 218, audit);
    return { templateId: instance.templateId, renderedTextBySlot: audit };
  },
};
