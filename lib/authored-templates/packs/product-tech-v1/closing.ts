import { evaluateContentEnvelope } from "../../content-envelope";
import type { AuthoredPageTemplate, ContentEnvelope } from "../../types";
import type { ProductClosingContent } from "./content";
import { createProductMeasurementContext, paintProductPaper, productTechV1VisualSystem as visual, productText } from "./visual-system";
const envelope: ContentEnvelope = { slots: [
  { id: "companyName", path: "companyName", kind: "text", required: true, fontFamily: "helvetica", fontStyle: "bold", fontSize: 34, widthMm: 148, maxLines: 3 },
  { id: "logo", path: "logo", kind: "image", required: false, allowedRoles: ["company_logo"], allowedProvenances: ["user_upload"] },
] };
export const productTechClosingTemplate: AuthoredPageTemplate<ProductClosingContent> = {
  id: "product-tech-v1.closing", pageRole: "closing", family: "product_closing", priority: 100, envelope,
  prepare: (input) => evaluateContentEnvelope("product-tech-v1.closing", envelope, input, createProductMeasurementContext()),
  render: (pdf, instance) => {
    paintProductPaper(pdf); pdf.setFillColor(...visual.palette.ink); pdf.rect(0, 0, 210, 18, "F"); pdf.setFillColor(...visual.palette.electric); pdf.rect(19, 48, 6, 6, "F");
    pdf.setTextColor(...visual.palette.electric); pdf.setFont("courier", "bold"); pdf.setFontSize(7.5); pdf.text("SYSTEM / COMPLETE", 31, 54);
    const name = productText(instance, "companyName"); pdf.setTextColor(...visual.palette.ink); pdf.setFont("helvetica", "bold"); pdf.setFontSize(34); pdf.setLineHeightFactor(1.02); pdf.text([...name.lines], 31, 127);
    pdf.setDrawColor(...visual.palette.line); pdf.setLineWidth(0.4); pdf.line(31, 176, 191, 176);
    const logo = instance.preparedSlots.logo; if (logo?.kind === "image") { const width = Math.min(48, 25 * logo.aspectRatio); pdf.addImage(logo.source.source, logo.source.format, 31, 231 - width / logo.aspectRatio, width, width / logo.aspectRatio); }
    pdf.setTextColor(...visual.palette.secondary); pdf.setFont("courier", "bold"); pdf.setFontSize(8); pdf.text("END OF PROFILE", 31, 264);
    return { templateId: instance.templateId, renderedTextBySlot: { companyName: name.lines } };
  },
};
