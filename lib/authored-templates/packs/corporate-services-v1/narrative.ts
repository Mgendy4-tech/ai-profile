import type { jsPDF } from "jspdf";
import { evaluateContentEnvelope } from "../../content-envelope";
import type { AuthoredPageTemplate, ContentEnvelope, TemplateRenderAudit } from "../../types";
import type { CorporateNarrativeContent } from "./content";
import { corporateServicesV1VisualSystem as v, createCorporateMeasurementContext, paintCorporatePaper, preparedCorporateText } from "./visual-system";

export const CORPORATE_SPARSE_NARRATIVE_BODY_REGION = {
  x: 70,
  y: 123,
  width: 112,
  maxLines: 10,
  lineHeightFactor: 1.55,
  fontSize: 9.5,
} as const;

const createNarrativeTemplate = (variant: "sparse" | "standard" | "dense", maxLines: number): AuthoredPageTemplate<CorporateNarrativeContent> => {
  const envelope: ContentEnvelope = { slots: [
    { id: "title", path: "title", kind: "text", required: true, fontFamily: "times", fontStyle: "bold", fontSize: 29, widthMm: 126, maxLines: 3 },
    { id: "supportingLine", path: "supportingLine", kind: "text", required: false, fontFamily: "helvetica", fontStyle: "normal", fontSize: 9.5, widthMm: 51, maxLines: 7 },
    { id: "body", path: "body", kind: "text", required: true, fontFamily: "helvetica", fontStyle: "normal", fontSize: 9.5, widthMm: variant === "dense" ? 50 : 112, maxLines },
  ] };
  const id = `corporate-services-v1.narrative-${variant}`;
  return {
    id, pageRole: "narrative", family: "corporate_narrative", priority: variant === "sparse" ? 110 : variant === "standard" ? 100 : 90, envelope,
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
      if (variant !== "dense") pdf.text([...body.lines], CORPORATE_SPARSE_NARRATIVE_BODY_REGION.x, CORPORATE_SPARSE_NARRATIVE_BODY_REGION.y);
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
export const corporateServicesNarrativeSparseTemplate = createNarrativeTemplate("sparse", 10);

const alternateNarrativeEnvelope: ContentEnvelope = { slots: [
  { id: "title", path: "title", kind: "text", required: true, fontFamily: "times", fontStyle: "bold", fontSize: 29, widthMm: 120, maxLines: 3 },
  { id: "supportingLine", path: "supportingLine", kind: "text", required: false, fontFamily: "helvetica", fontStyle: "normal", fontSize: 9.5, widthMm: 38, maxLines: 7 },
  { id: "body", path: "body", kind: "text", required: true, fontFamily: "helvetica", fontStyle: "normal", fontSize: 9.5, widthMm: 112, maxLines: 13 },
] };

export const corporateServicesNarrativeAlternateTemplate: AuthoredPageTemplate<CorporateNarrativeContent> = {
  id: "corporate-services-v1.narrative-alternate", pageRole: "narrative", family: "corporate_narrative", priority: 95, envelope: alternateNarrativeEnvelope,
  prepare: (input) => evaluateContentEnvelope("corporate-services-v1.narrative-alternate", alternateNarrativeEnvelope, input, createCorporateMeasurementContext(), [input.contentId]),
  render: (pdf, instance): TemplateRenderAudit => {
    paintCorporatePaper(pdf);
    pdf.setFillColor(...v.palette.navy); pdf.rect(0, 0, 210, 30, "F");
    pdf.setTextColor(...v.palette.white); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setCharSpace(0.55); pdf.text("BUSINESS PROFILE / CONTINUED", 19, 20); pdf.setCharSpace(0);
    const title = preparedCorporateText(instance, "title");
    pdf.setTextColor(...v.palette.ink); pdf.setFont("times", "bold"); pdf.setFontSize(29); pdf.setLineHeightFactor(1); pdf.text([...title.lines], 19, 67);
    pdf.setDrawColor(...v.palette.cobalt); pdf.setLineWidth(0.8); pdf.line(19, 91, 51, 91);
    const body = preparedCorporateText(instance, "body");
    pdf.setTextColor(...v.palette.ink); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5); pdf.setLineHeightFactor(1.55); pdf.text([...body.lines], 19, 119);
    const supporting = preparedCorporateText(instance, "supportingLine");
    pdf.setFillColor(...v.palette.mist); pdf.rect(148, 91, 43, 136, "F");
    pdf.setTextColor(...v.palette.cobalt); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.text("FOCUS", 158, 112);
    pdf.setTextColor(...v.palette.muted); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); pdf.setLineHeightFactor(1.45); pdf.text([...supporting.lines], 158, 130);
    pdf.setDrawColor(...v.palette.mist); pdf.setLineWidth(0.35); pdf.line(19, 270, 191, 270);
    return { templateId: instance.templateId, renderedTextBySlot: { title: title.lines, supportingLine: supporting.lines, body: body.lines } };
  },
};
