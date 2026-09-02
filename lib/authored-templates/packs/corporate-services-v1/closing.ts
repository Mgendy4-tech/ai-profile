import { evaluateContentEnvelope } from "../../content-envelope";
import type { AuthoredPageTemplate, ContentEnvelope } from "../../types";
import type { CorporateClosingContent } from "./content";
import { corporateServicesV1VisualSystem as visual, createCorporateMeasurementContext, paintCorporatePaper, preparedCorporateText } from "./visual-system";
const envelope: ContentEnvelope = { slots: [
  { id: "companyName", path: "companyName", kind: "text", required: true, fontFamily: "times", fontStyle: "bold", fontSize: 34, widthMm: 146, maxLines: 3 },
  { id: "logo", path: "logo", kind: "image", required: false, allowedRoles: ["company_logo"], allowedProvenances: ["user_upload"] },
] };
export const corporateServicesClosingTemplate: AuthoredPageTemplate<CorporateClosingContent> = {
  id: "corporate-services-v1.closing", pageRole: "closing", family: "corporate_closing", priority: 100, envelope,
  prepare: (input) => evaluateContentEnvelope("corporate-services-v1.closing", envelope, input, createCorporateMeasurementContext()),
  render: (pdf, instance) => {
    paintCorporatePaper(pdf); pdf.setFillColor(...visual.palette.navy); pdf.rect(0, 0, 16, 297, "F");
    pdf.setTextColor(...visual.palette.cobalt); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setCharSpace(0.6); pdf.text("CLOSING", 31, 51); pdf.setCharSpace(0);
    const name = preparedCorporateText(instance, "companyName"); pdf.setTextColor(...visual.palette.navy); pdf.setFont("times", "bold"); pdf.setFontSize(34); pdf.setLineHeightFactor(1.05); pdf.text([...name.lines], 31, 125);
    pdf.setDrawColor(...visual.palette.cobalt); pdf.setLineWidth(1); pdf.line(31, 173, 92, 173);
    const logo = instance.preparedSlots.logo; if (logo?.kind === "image") { const width = Math.min(48, 25 * logo.aspectRatio); pdf.addImage(logo.source.source, logo.source.format, 31, 230 - width / logo.aspectRatio, width, width / logo.aspectRatio); }
    pdf.setTextColor(...visual.palette.muted); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.text("COMPANY PROFILE", 31, 263);
    return { templateId: instance.templateId, renderedTextBySlot: { companyName: name.lines } };
  },
};
