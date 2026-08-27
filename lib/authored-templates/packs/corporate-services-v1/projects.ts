import type { jsPDF } from "jspdf";
import { evaluateContentEnvelope } from "../../content-envelope";
import type { AuthoredPageTemplate, ContentEnvelope, TemplateRenderAudit } from "../../types";
import type { CorporateProjectsPageContent } from "./content";
import { corporateServicesV1VisualSystem as v, createCorporateMeasurementContext, paintCorporatePaper, preparedCorporateText } from "./visual-system";

type Count = 1 | 2 | 3;
const FIXED_COLUMNS = {
  1: { x: [19], width: 68 },
  2: { x: [19, 111], width: 68 },
  3: { x: [19, 79, 139], width: 52 },
} as const;

const templateFor = (count: Count): AuthoredPageTemplate<CorporateProjectsPageContent> => {
  const id = `corporate-services-v1.work-${count}`;
  const envelope: ContentEnvelope = { slots: [
    { id: "heading", path: "heading", kind: "text", required: true, fontFamily: "times", fontStyle: "bold", fontSize: 29, widthMm: 120, maxLines: 2 },
    { id: "supportingLine", path: "supportingLine", kind: "text", required: false, fontFamily: "helvetica", fontStyle: "normal", fontSize: 9.5, widthMm: 120, maxLines: 3 },
    { id: "projects", path: "projects", kind: "collection", required: true, minItems: count, maxItems: count },
    ...Array.from({ length: count }, (_, index) => [
      { id: `project${index}Name`, path: `projects.${index}.name`, kind: "text" as const, required: true, fontFamily: "times", fontStyle: "bold" as const, fontSize: 18, widthMm: 68, maxLines: 2 },
      { id: `project${index}Description`, path: `projects.${index}.description`, kind: "text" as const, required: true, fontFamily: "helvetica", fontStyle: "normal" as const, fontSize: 8.5, widthMm: 68, maxLines: 8 },
    ]).flat(),
  ] };
  return {
    id, pageRole: "project_grid", family: "corporate_services", priority: 80, envelope,
    prepare: (input) => evaluateContentEnvelope(id, envelope, input, createCorporateMeasurementContext(), input.projects.map((project) => project.contentId)),
    render: (pdf: jsPDF, instance): TemplateRenderAudit => {
      paintCorporatePaper(pdf);
      const audit: Record<string, readonly string[]> = {};
      pdf.setFillColor(...v.palette.navy); pdf.rect(0, 0, 210, 36, "F");
      pdf.setTextColor(...v.palette.white); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.text("04 / SELECTED WORK", 19, 23);
      const heading = preparedCorporateText(instance, "heading"); audit.heading = heading.lines;
      pdf.setTextColor(...v.palette.ink); pdf.setFont("times", "bold"); pdf.setFontSize(29); pdf.setLineHeightFactor(1); pdf.text([...heading.lines], 19, 65);
      const supporting = preparedCorporateText(instance, "supportingLine"); audit.supportingLine = supporting.lines;
      pdf.setTextColor(...v.palette.muted); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.5); pdf.setLineHeightFactor(1.35); pdf.text([...supporting.lines], 19, 88);
      const columns = FIXED_COLUMNS[count];
      instance.source.projects.forEach((_, index) => {
        const x = columns.x[index]; const width = columns.width;
        if (index === 0) pdf.setFillColor(...v.palette.cobalt); else pdf.setFillColor(...v.palette.navy);
        pdf.rect(x, 116, width, 6, "F");
        const name = preparedCorporateText(instance, `project${index}Name`); const description = preparedCorporateText(instance, `project${index}Description`);
        audit[`project${index}Name`] = name.lines; audit[`project${index}Description`] = description.lines;
        pdf.setTextColor(...v.palette.ink); pdf.setFont("times", "bold"); pdf.setFontSize(18); pdf.setLineHeightFactor(1.05); pdf.text([...name.lines], x, 145);
        pdf.setTextColor(...v.palette.muted); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.setLineHeightFactor(1.4); pdf.text([...description.lines], x, 180, { maxWidth: width });
      });
      pdf.setDrawColor(...v.palette.mist); pdf.setLineWidth(0.35); pdf.line(19, 270, 191, 270);
      return { templateId: id, renderedTextBySlot: audit };
    },
  };
};

export const corporateServicesProjectTemplates = ([1, 2, 3] as const).map(templateFor);
