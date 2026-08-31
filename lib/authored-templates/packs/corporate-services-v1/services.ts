import type { jsPDF } from "jspdf";
import { evaluateContentEnvelope } from "../../content-envelope";
import type { AuthoredPageTemplate, ContentEnvelope, TemplateRenderAudit } from "../../types";
import type { CorporateServicesPageContent } from "./content";
import { corporateServicesV1VisualSystem as v, createCorporateMeasurementContext, paintCorporatePaper, preparedCorporateText } from "./visual-system";

type Definition = { count: 1 | 2 | 3 | 4; continuation: boolean; id: string; rowTops: readonly number[] };

const FIXED_ROW_TOPS = {
  1: [112],
  2: [112, 194],
  3: [112, 166.667, 221.333],
  4: [112, 153, 194, 235],
} as const;

export const CORPORATE_SERVICES_TEXT_GEOMETRY = {
  top: 112,
  bottom: 276,
  indexX: 19,
  titleX: 42,
  titleWidth: 52,
  descriptionX: 105,
  descriptionWidth: 86,
  titleYOffset: 13,
  descriptionYOffset: 12,
} as const;

const templateFor = (definition: Definition): AuthoredPageTemplate<CorporateServicesPageContent> => {
  const envelope: ContentEnvelope = { slots: [
    ...(!definition.continuation ? [
      { id: "heading", path: "heading", kind: "text" as const, required: true, fontFamily: "times", fontStyle: "bold" as const, fontSize: 29, widthMm: 112, maxLines: 2 },
      { id: "supportingLine", path: "supportingLine", kind: "text" as const, required: false, fontFamily: "helvetica", fontStyle: "normal" as const, fontSize: 9.5, widthMm: 112, maxLines: 3 },
    ] : []),
    { id: "services", path: "services", kind: "collection", required: true, minItems: definition.count, maxItems: definition.count },
    ...Array.from({ length: definition.count }, (_, index) => [
      { id: `service${index}Title`, path: `services.${index}.title`, kind: "text" as const, required: true, fontFamily: "times", fontStyle: "bold" as const, fontSize: 17, widthMm: CORPORATE_SERVICES_TEXT_GEOMETRY.titleWidth, maxLines: 2 },
      { id: `service${index}Description`, path: `services.${index}.description`, kind: "text" as const, required: true, fontFamily: "helvetica", fontStyle: "normal" as const, fontSize: 8.5, widthMm: CORPORATE_SERVICES_TEXT_GEOMETRY.descriptionWidth, maxLines: 6 },
    ]).flat(),
  ] };
  return {
    id: definition.id, pageRole: definition.continuation ? "continuation" : "capabilities", family: "corporate_services", priority: 100, envelope,
    prepare: (input) => evaluateContentEnvelope(definition.id, envelope, input, createCorporateMeasurementContext(), input.services.map((service) => service.contentId)),
    render: (pdf: jsPDF, instance): TemplateRenderAudit => {
      paintCorporatePaper(pdf);
      const audit: Record<string, readonly string[]> = {};
      pdf.setFillColor(...v.palette.navy); pdf.rect(0, 0, 210, 36, "F");
      pdf.setTextColor(...v.palette.white); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.text(definition.continuation ? "SERVICES / CONTINUED" : "02 / SERVICES", 19, 23);
      if (definition.continuation) {
        pdf.setTextColor(...v.palette.ink); pdf.setFont("times", "bold"); pdf.setFontSize(17); pdf.text("Additional Services", 19, 69);
      } else {
        const heading = preparedCorporateText(instance, "heading"); audit.heading = heading.lines;
        pdf.setTextColor(...v.palette.ink); pdf.setFont("times", "bold"); pdf.setFontSize(29); pdf.setLineHeightFactor(1); pdf.text([...heading.lines], 19, 65);
        const supporting = preparedCorporateText(instance, "supportingLine"); audit.supportingLine = supporting.lines;
        pdf.setTextColor(...v.palette.muted); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5); pdf.setLineHeightFactor(1.35); pdf.text([...supporting.lines], 19, 88);
      }
      instance.source.services.forEach((service, index) => {
        const y = definition.rowTops[index];
        if (index === 0) pdf.setDrawColor(...v.palette.cobalt); else pdf.setDrawColor(...v.palette.mist); pdf.setLineWidth(index === 0 ? 0.8 : 0.35); pdf.line(19, y, 191, y);
        pdf.setTextColor(...v.palette.cobalt); pdf.setFont("helvetica", "bold"); pdf.setFontSize(8); pdf.text(service.index, CORPORATE_SERVICES_TEXT_GEOMETRY.indexX, y + CORPORATE_SERVICES_TEXT_GEOMETRY.titleYOffset);
        const title = preparedCorporateText(instance, `service${index}Title`); const description = preparedCorporateText(instance, `service${index}Description`);
        audit[`service${index}Title`] = title.lines; audit[`service${index}Description`] = description.lines;
        pdf.setTextColor(...v.palette.ink); pdf.setFont("times", "bold"); pdf.setFontSize(17); pdf.setLineHeightFactor(1); pdf.text([...title.lines], CORPORATE_SERVICES_TEXT_GEOMETRY.titleX, y + CORPORATE_SERVICES_TEXT_GEOMETRY.titleYOffset);
        pdf.setTextColor(...v.palette.muted); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.setLineHeightFactor(1.3); pdf.text([...description.lines], CORPORATE_SERVICES_TEXT_GEOMETRY.descriptionX, y + CORPORATE_SERVICES_TEXT_GEOMETRY.descriptionYOffset);
      });
      pdf.setDrawColor(...v.palette.mist); pdf.setLineWidth(0.35); pdf.line(19, 276, 191, 276);
      return { templateId: definition.id, renderedTextBySlot: audit };
    },
  };
};

export const corporateServicesPrimaryTemplates = ([1, 2, 3, 4] as const).map((count) => templateFor({ count, continuation: false, id: `corporate-services-v1.services-${count}`, rowTops: FIXED_ROW_TOPS[count] }));
export const corporateServicesContinuationTemplates = ([1, 2, 3, 4] as const).map((count) => templateFor({ count, continuation: true, id: `corporate-services-v1.services-continuation-${count}`, rowTops: FIXED_ROW_TOPS[count] }));
