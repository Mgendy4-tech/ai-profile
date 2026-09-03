import type { jsPDF } from "jspdf";
import { evaluateContentEnvelope } from "../../content-envelope";
import type { AuthoredPageTemplate, ContentEnvelope, TemplateInstance, TemplateRenderAudit } from "../../types";
import type { CapabilitiesContinuationContent } from "./content";
import { createEditorialInteriorsMeasurementContext, editorialInteriorsV1VisualSystem as visual, getPreparedText, paintPaper } from "./visual-system";

const positionsByCount = {
  1: [{ x: 64, y: 126 }],
  2: [{ x: 19, y: 126 }, { x: 109, y: 126 }],
  3: [{ x: 64, y: 91 }, { x: 19, y: 190 }, { x: 109, y: 190 }],
  4: [{ x: 19, y: 86 }, { x: 109, y: 86 }, { x: 19, y: 184 }, { x: 109, y: 184 }],
} as const;

const createTemplate = (count: 1 | 2 | 3 | 4): AuthoredPageTemplate<CapabilitiesContinuationContent> => {
  const envelope: ContentEnvelope = { slots: [
    { id: "heading", path: "heading", kind: "text", required: true, fontFamily: "times", fontStyle: "normal", fontSize: 30, widthMm: 172, maxLines: 1 },
    { id: "supportingLine", path: "supportingLine", kind: "text", required: true, fontFamily: "helvetica", fontStyle: "normal", fontSize: 9, widthMm: 128, maxLines: 2 },
    { id: "capabilities", path: "capabilities", kind: "collection", required: true, minItems: count, maxItems: count },
    ...Array.from({ length: count }, (_, index) => [
      { id: `capability${index}Title`, path: `capabilities.${index}.title`, kind: "text" as const, required: true, fontFamily: "times", fontStyle: "bold" as const, fontSize: 15, widthMm: 70, maxLines: 2 },
      { id: `capability${index}Description`, path: `capabilities.${index}.description`, kind: "text" as const, required: true, fontFamily: "helvetica", fontStyle: "normal" as const, fontSize: 8.8, widthMm: 70, maxLines: 4 },
    ]).flat(),
  ] };
  const id = `editorial-interiors-v1.capabilities-continuation-${count}`;
  return {
    id, pageRole: "continuation", family: "editorial_capabilities", priority: 100, envelope,
    prepare: (input) => evaluateContentEnvelope(id, envelope, input, createEditorialInteriorsMeasurementContext(), input.capabilities.map((capability) => capability.index)),
    render: (pdf: jsPDF, instance: TemplateInstance<CapabilitiesContinuationContent>): TemplateRenderAudit => {
      paintPaper(pdf); const audit: Record<string, readonly string[]> = {};
      const draw = (slotId: string, x: number, y: number) => { const prepared = getPreparedText(instance, slotId); pdf.text([...prepared.lines], x, y); audit[slotId] = prepared.lines; };
      pdf.setTextColor(...visual.palette.secondary); pdf.setFont("helvetica", "bold"); pdf.setFontSize(7.5); pdf.setCharSpace(0.7); pdf.text(instance.source.eyebrow, 19, 25); pdf.setCharSpace(0);
      pdf.setTextColor(...visual.palette.charcoal); pdf.setFont("times", "normal"); pdf.setFontSize(30); draw("heading", 19, 49);
      pdf.setTextColor(...visual.palette.secondary); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9); draw("supportingLine", 19, 62);
      instance.source.capabilities.forEach((capability, index) => { const origin = positionsByCount[count][index];
        pdf.setDrawColor(...visual.palette.hairline); pdf.setLineWidth(0.25); pdf.line(origin.x, origin.y, origin.x + 82, origin.y);
        pdf.setTextColor(...visual.palette.ochre); pdf.setFont("times", "normal"); pdf.setFontSize(25); pdf.text(capability.index, origin.x, origin.y + 17);
        pdf.setTextColor(...visual.palette.charcoal); pdf.setFont("times", "bold"); pdf.setFontSize(15); pdf.setLineHeightFactor(1.05); draw(`capability${index}Title`, origin.x, origin.y + 31);
        pdf.setTextColor(...visual.palette.secondary); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.8); pdf.setLineHeightFactor(1.4); draw(`capability${index}Description`, origin.x, origin.y + 53);
      });
      return { templateId: id, renderedTextBySlot: audit };
    },
  };
};

export const editorialInteriorsCapabilitiesContinuationTemplates = ([1, 2, 3, 4] as const).map(createTemplate);
