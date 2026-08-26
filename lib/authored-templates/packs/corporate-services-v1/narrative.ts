import type { jsPDF } from "jspdf";
import { evaluateContentEnvelope } from "../../content-envelope";
import type { AuthoredPageTemplate, ContentEnvelope, TemplateRenderAudit } from "../../types";
import type { CorporateNarrativeContent } from "./content";
import { corporateServicesV1VisualSystem as v, createCorporateMeasurementContext, paintCorporatePaper, preparedCorporateText } from "./visual-system";

const createNarrativeTemplate = (variant: "standard" | "dense", maxLines: number): AuthoredPageTemplate<CorporateNarrativeContent> => {
  const envelope: ContentEnvelope = { slots: [
    { id: "title", path: "title", kind: "text", required: true, fontFamily: "times", fontStyle: "bold", fontSize: 29, widthMm: 126, maxLines: 3 },
    { id: "supportingLine", path: "supportingLine", kind: "text", required: false, fontFamily: "helvetica", fontStyle: "normal", fontSize: 9.5, widthMm: 51, maxLines: 7 },
    { id: "body", path: "body", kind: "text", required: true, fontFamily: "helvetica", fontStyle: "normal", fontSize: 9.5, widthMm: variant === "standard" ? 112 : 50, maxLines },
  ] };
  const id = `corporate-services-v1.narrative-${variant}`;
  return {
    id, pageRole: "narrative", family: "corporate_narrative", priority: variant === "standard" ? 100 : 90, envelope,
    prepare: (input) => evaluateContentEnvelope(id, envelope, input, createCorporateMeasurementContext(), [input.contentId]),
    render: (pdf: jsPDF, instance): TemplateRenderAudit => {
      paintCorporatePaper(pdf);
      pdf.setTextColor(...v.palette.cobalt); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.text("01 / COMPANY", 19, 24);
      pdf.setFillColor(...v.palette.navy); pdf.rect(0, 52, 52, 205, "F");
      pdf.setTextColor(...v.palette.white); pdf.setFont("times", "bold"); pdf.setFontSize(54); pdf.text("01", 17, 91);
      const supporting = preparedCorporateText(instance, "supportingLine");
      pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setLineHeightFactor(1.45); pdf.text([...supporting.lines], 17, 119, { maxWidth: 25 });
      const title = preparedCorporateText(instance, "title");
      pdf.setTextColor(...v.palette.ink); pdf.setFont("times", "bold"); pdf.setFontSize(29); pdf.setLineHeightFactor(1); pdf.text([...title.lines], 70, 66);
      pdf.setDrawColor(...v.palette.cobalt); pdf.setLineWidth(0.8); pdf.line(70, 102, 100, 102);
      const body = preparedCorporateText(instance, "body");
      pdf.setTextColor(...v.palette.ink); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5); pdf.setLineHeightFactor(1.55);
      if (variant === "standard") pdf.text([...body.lines], 70, 123);
      else {
        const split = Math.ceil(body.lines.length / 2);
        pdf.text([...body.lines.slice(0, split)], 70, 123);
        pdf.text([...body.lines.slice(split)], 136, 123);
      }
      pdf.setDrawColor(...v.palette.mist); pdf.setLineWidth(0.35); pdf.line(70, 270, 191, 270);
      return { templateId: id, renderedTextBySlot: { title: title.lines, supportingLine: supporting.lines, body: body.lines } };
    },
  };
};

export const corporateServicesNarrativeStandardTemplate = createNarrativeTemplate("standard", 24);
export const corporateServicesNarrativeDenseTemplate = createNarrativeTemplate("dense", 56);
