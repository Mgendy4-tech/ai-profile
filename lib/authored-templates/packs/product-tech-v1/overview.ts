import { evaluateContentEnvelope } from "../../content-envelope";
import type { AuthoredPageTemplate, ContentEnvelope, TemplateRenderAudit } from "../../types";
import type { ProductOverviewContent } from "./content";
import { createProductMeasurementContext, paintProductPaper, productTechV1VisualSystem as v, productText } from "./visual-system";

const envelope: ContentEnvelope = { slots: [
  { id: "title", path: "title", kind: "text", required: true, fontFamily: "helvetica", fontStyle: "bold", fontSize: 25, widthMm: 132, maxLines: 3 },
  { id: "supportingLine", path: "supportingLine", kind: "text", required: false, fontFamily: "helvetica", fontStyle: "normal", fontSize: 8.5, widthMm: 26, maxLines: 7 },
  { id: "body", path: "body", kind: "text", required: true, fontFamily: "helvetica", fontStyle: "normal", fontSize: 9.25, widthMm: 113, maxLines: 29 },
] };
export const productTechOverviewTemplate: AuthoredPageTemplate<ProductOverviewContent> = {
  id: "product-tech-v1.overview", pageRole: "narrative", family: "product_overview", priority: 100, envelope,
  prepare: (input) => {
    const result = evaluateContentEnvelope("product-tech-v1.overview", envelope, input, createProductMeasurementContext(), [input.contentId]);
    if (!result.compatible || !input.supportingLine) return result;
    const prepared = result.instance.preparedSlots.supportingLine;
    if (!prepared || prepared.kind !== "text") return result;
    const renderedTokens = new Set(prepared.lines.flatMap((line) => line.trim().split(/\s+/).filter(Boolean)));
    const splitWord = input.supportingLine.trim().split(/\s+/).find((word) => word && !renderedTokens.has(word));
    return splitWord ? { compatible: false as const, instance: null, issues: [{ code: "text_word_width_exceeded" as const, path: "supportingLine", slotId: "supportingLine", message: `Supporting-text word ${splitWord} exceeds the fixed rail width.` }] } : result;
  },
  render: (pdf, instance): TemplateRenderAudit => {
    paintProductPaper(pdf); pdf.setFillColor(...v.palette.ink); pdf.rect(0, 0, 42, 297, "F"); pdf.setFillColor(...v.palette.signal); pdf.rect(19, 24, 12, 2.5, "F");
    pdf.setTextColor(...v.palette.white); pdf.setFont("courier", "bold"); pdf.setFontSize(7.5); pdf.text("01 / OVERVIEW", 13, 44);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(38); pdf.text("01", 13, 86);
    const support = productText(instance, "supportingLine"); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.setLineHeightFactor(1.4); pdf.text([...support.lines], 13, 118);
    const title = productText(instance, "title"); pdf.setTextColor(...v.palette.ink); pdf.setFont("helvetica", "bold"); pdf.setFontSize(25); pdf.setLineHeightFactor(1.02); pdf.text([...title.lines], 61, 62);
    pdf.setDrawColor(...v.palette.electric); pdf.setLineWidth(1); pdf.line(61, 102, 93, 102);
    const body = productText(instance, "body"); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.25); pdf.setLineHeightFactor(1.55); pdf.text([...body.lines], 61, 124);
    pdf.setDrawColor(...v.palette.line); pdf.setLineWidth(0.3); pdf.line(61, 274, 191, 274);
    return { templateId: instance.templateId, renderedTextBySlot: { title: title.lines, supportingLine: support.lines, body: body.lines } };
  },
};
