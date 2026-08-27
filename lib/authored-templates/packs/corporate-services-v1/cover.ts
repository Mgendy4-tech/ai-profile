import type { jsPDF } from "jspdf";
import { evaluateContentEnvelope } from "../../content-envelope";
import type { AuthoredPageTemplate, ContentEnvelope, TemplateRenderAudit } from "../../types";
import type { CorporateCoverContent } from "./content";
import { drawContainedOptionalLogo, preparedOptionalLogo } from "../logo";
import { corporateServicesV1VisualSystem as v, createCorporateMeasurementContext, paintCorporatePaper, preparedCorporateText } from "./visual-system";

const envelope: ContentEnvelope = { slots: [
  { id: "documentLabel", path: "documentLabel", kind: "text", required: true, fontFamily: "helvetica", fontStyle: "bold", fontSize: 7.5, widthMm: 75, maxLines: 1 },
  { id: "companyName", path: "companyName", kind: "text", required: true, fontFamily: "times", fontStyle: "bold", fontSize: 38, widthMm: 105, maxLines: 4 },
  { id: "companyType", path: "companyType", kind: "text", required: true, fontFamily: "helvetica", fontStyle: "normal", fontSize: 9.5, widthMm: 90, maxLines: 2 },
  { id: "logo", path: "logo", kind: "image", required: false, allowedRoles: ["company_logo"], allowedProvenances: ["user_upload"] },
] };

export const corporateServicesCoverTemplate: AuthoredPageTemplate<CorporateCoverContent> = {
  id: "corporate-services-v1.cover", pageRole: "cover", family: "corporate_cover", priority: 100, envelope,
  prepare: (input) => evaluateContentEnvelope("corporate-services-v1.cover", envelope, input, createCorporateMeasurementContext(), [input.contentId]),
  render: (pdf, instance): TemplateRenderAudit => {
    paintCorporatePaper(pdf);
    pdf.setFillColor(...v.palette.navy); pdf.rect(0, 0, 72, 297, "F");
    pdf.setFillColor(...v.palette.cobalt); pdf.rect(18, 24, 12, 2.2, "F");
    drawContainedOptionalLogo(pdf, preparedOptionalLogo(instance), { x: 18, y: 55, width: 36, height: 22 }, v.palette.white);
    pdf.setTextColor(...v.palette.white); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setCharSpace(0.5); pdf.text(preparedCorporateText(instance, "documentLabel").lines[0], 18, 38); pdf.setCharSpace(0);
    pdf.setDrawColor(255, 255, 255); pdf.setLineWidth(0.25); pdf.line(18, 259, 54, 259);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(7); pdf.text("CORPORATE / SERVICES", 18, 269);
    const name = preparedCorporateText(instance, "companyName");
    pdf.setTextColor(...v.palette.ink); pdf.setFont("times", "bold"); pdf.setFontSize(38); pdf.setLineHeightFactor(0.92); pdf.text([...name.lines], 91, 104);
    const type = preparedCorporateText(instance, "companyType");
    const typeY = 119 + name.lines.length * 12.4;
    pdf.setDrawColor(...v.palette.cobalt); pdf.setLineWidth(0.8); pdf.line(91, typeY - 8, 118, typeY - 8);
    pdf.setTextColor(...v.palette.muted); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5); pdf.setLineHeightFactor(1.35); pdf.text([...type.lines], 91, typeY);
    return { templateId: instance.templateId, renderedTextBySlot: { documentLabel: preparedCorporateText(instance, "documentLabel").lines, companyName: name.lines, companyType: type.lines } };
  },
};
