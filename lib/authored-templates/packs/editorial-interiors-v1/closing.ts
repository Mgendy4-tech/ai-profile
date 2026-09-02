import { evaluateContentEnvelope } from "../../content-envelope";
import type { AuthoredPageTemplate, ContentEnvelope } from "../../types";
import type { EditorialClosingContent } from "./content";
import { createEditorialInteriorsMeasurementContext, editorialInteriorsV1VisualSystem as visual, getPreparedText, paintPaper } from "./visual-system";

const envelope: ContentEnvelope = { slots: [
  { id: "companyName", path: "companyName", kind: "text", required: true, fontFamily: "times", fontStyle: "normal", fontSize: 38, widthMm: 150, maxLines: 3 },
  { id: "logo", path: "logo", kind: "image", required: false, allowedRoles: ["company_logo"], allowedProvenances: ["user_upload"] },
] };

export const editorialInteriorsClosingTemplate: AuthoredPageTemplate<EditorialClosingContent> = {
  id: "editorial-interiors-v1.closing", pageRole: "closing", family: "editorial_closing", priority: 100, envelope,
  prepare: (input) => evaluateContentEnvelope("editorial-interiors-v1.closing", envelope, input, createEditorialInteriorsMeasurementContext()),
  render: (pdf, instance) => {
    paintPaper(pdf);
    pdf.setDrawColor(...visual.palette.ochre); pdf.setLineWidth(0.8); pdf.line(19, 37, 52, 37);
    pdf.setTextColor(...visual.palette.secondary); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setCharSpace(0.7); pdf.text("END / COMPANY PROFILE", 19, 54); pdf.setCharSpace(0);
    const name = getPreparedText(instance, "companyName"); pdf.setTextColor(...visual.palette.charcoal); pdf.setFont("times", "normal"); pdf.setFontSize(38); pdf.setLineHeightFactor(1.05); pdf.text([...name.lines], 19, 139);
    const logo = instance.preparedSlots.logo;
    if (logo?.kind === "image") { const ratio = logo.aspectRatio; const width = Math.min(52, 28 * ratio); const height = width / ratio; pdf.addImage(logo.source.source, logo.source.format, 19, 234 - height, width, height); }
    pdf.setTextColor(...visual.palette.ochre); pdf.setFont("times", "italic"); pdf.setFontSize(15); pdf.text("Thank you.", 19, 261);
    return { templateId: instance.templateId, renderedTextBySlot: { companyName: name.lines } };
  },
};
