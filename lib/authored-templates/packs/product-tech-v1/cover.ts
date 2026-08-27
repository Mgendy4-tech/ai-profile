import { evaluateContentEnvelope } from "../../content-envelope";
import type { AuthoredPageTemplate, ContentEnvelope, TemplateRenderAudit } from "../../types";
import type { ProductTechCoverContent } from "./content";
import { drawContainedOptionalLogo, preparedOptionalLogo } from "../logo";
import { createProductMeasurementContext, productTechV1VisualSystem as v, productText } from "./visual-system";

const envelope: ContentEnvelope = { slots: [
  { id: "documentLabel", path: "documentLabel", kind: "text", required: true, fontFamily: "courier", fontStyle: "bold", fontSize: 7.5, widthMm: 70, maxLines: 1 },
  { id: "companyName", path: "companyName", kind: "text", required: true, fontFamily: "helvetica", fontStyle: "bold", fontSize: 35, widthMm: 145, maxLines: 3 },
  { id: "companyType", path: "companyType", kind: "text", required: true, fontFamily: "helvetica", fontStyle: "normal", fontSize: 9.25, widthMm: 105, maxLines: 2 },
  { id: "logo", path: "logo", kind: "image", required: false, allowedRoles: ["company_logo"], allowedProvenances: ["user_upload"] },
] };

export const productTechCoverTemplate: AuthoredPageTemplate<ProductTechCoverContent> = {
  id: "product-tech-v1.cover", pageRole: "cover", family: "product_cover", priority: 100, envelope,
  prepare: (input) => evaluateContentEnvelope("product-tech-v1.cover", envelope, input, createProductMeasurementContext(), [input.contentId]),
  render: (pdf, instance): TemplateRenderAudit => {
    pdf.setFillColor(...v.palette.ink); pdf.rect(0, 0, 210, 297, "F");
    pdf.setFillColor(...v.palette.electric); pdf.rect(0, 0, 7, 297, "F");
    pdf.setDrawColor(62, 76, 94); pdf.setLineWidth(0.25); for (const x of [35, 70, 105, 140, 175]) pdf.line(x, 0, x, 297); for (const y of [54, 108, 162, 216, 270]) pdf.line(7, y, 210, y);
    pdf.setFillColor(...v.palette.signal); pdf.rect(175, 32, 16, 3, "F");
    drawContainedOptionalLogo(pdf, preparedOptionalLogo(instance), { x: 151, y: 15, width: 40, height: 14 }, v.palette.white);
    const label = productText(instance, "documentLabel"); pdf.setTextColor(...v.palette.white); pdf.setFont("courier", "bold"); pdf.setFontSize(7.5); pdf.text(label.lines[0], 25, 35);
    const name = productText(instance, "companyName"); pdf.setFont("helvetica", "bold"); pdf.setFontSize(35); pdf.setLineHeightFactor(0.95); pdf.text([...name.lines], 25, 125);
    const type = productText(instance, "companyType"); pdf.setTextColor(184, 195, 210); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.25); pdf.setLineHeightFactor(1.35); pdf.text([...type.lines], 25, 176);
    pdf.setTextColor(...v.palette.signal); pdf.setFont("courier", "bold"); pdf.setFontSize(7); pdf.text("PRODUCT SYSTEM / 01", 25, 268);
    return { templateId: instance.templateId, renderedTextBySlot: { documentLabel: label.lines, companyName: name.lines, companyType: type.lines } };
  },
};
