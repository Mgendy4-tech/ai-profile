import { evaluateContentEnvelope } from "../../content-envelope";
import type { AuthoredPageTemplate, ContentEnvelope, TemplateRenderAudit } from "../../types";
import type { CorporateApproachContent } from "./content";
import { corporateServicesV1VisualSystem as v, createCorporateMeasurementContext, paintCorporatePaper, preparedCorporateText } from "./visual-system";

const envelope: ContentEnvelope = { slots: [
  { id: "heading", path: "heading", kind: "text", required: true, fontFamily: "times", fontStyle: "bold", fontSize: 29, widthMm: 130, maxLines: 2 },
  { id: "activities", path: "activities", kind: "text", required: true, fontFamily: "helvetica", fontStyle: "normal", fontSize: 9.5, widthMm: 70, maxLines: 16 },
  { id: "experience", path: "experience", kind: "text", required: true, fontFamily: "helvetica", fontStyle: "normal", fontSize: 9.5, widthMm: 70, maxLines: 16 },
] };

export const corporateServicesApproachTemplate: AuthoredPageTemplate<CorporateApproachContent> = {
  id: "corporate-services-v1.approach", pageRole: "narrative", family: "corporate_narrative", priority: 80, envelope,
  prepare: (input) => evaluateContentEnvelope("corporate-services-v1.approach", envelope, input, createCorporateMeasurementContext()),
  render: (pdf, instance): TemplateRenderAudit => {
    paintCorporatePaper(pdf);
    pdf.setTextColor(...v.palette.cobalt); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.text("03 / BUSINESS PROFILE", 19, 24);
    const heading = preparedCorporateText(instance, "heading"); pdf.setTextColor(...v.palette.ink); pdf.setFont("times", "bold"); pdf.setFontSize(29); pdf.setLineHeightFactor(1); pdf.text([...heading.lines], 19, 61);
    pdf.setFillColor(...v.palette.navy); pdf.rect(0, 91, 210, 44, "F"); pdf.setFillColor(...v.palette.cobalt); pdf.rect(19, 111, 28, 2, "F");
    const activities = preparedCorporateText(instance, "activities"); const experience = preparedCorporateText(instance, "experience");
    pdf.setTextColor(...v.palette.cobalt); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.text("ACTIVITIES", 19, 163); pdf.text("EXPERIENCE", 111, 163);
    pdf.setDrawColor(...v.palette.mist); pdf.setLineWidth(0.4); pdf.line(98, 151, 98, 265);
    pdf.setTextColor(...v.palette.ink); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5); pdf.setLineHeightFactor(1.5); pdf.text([...activities.lines], 19, 181); pdf.text([...experience.lines], 111, 181);
    return { templateId: instance.templateId, renderedTextBySlot: { heading: heading.lines, activities: activities.lines, experience: experience.lines } };
  },
};
