import { evaluateContentEnvelope } from "../../content-envelope";
import type { AuthoredPageTemplate, ContentEnvelope, TemplateRenderAudit } from "../../types";
import type { ProductUseCasesPageContent } from "./content";
import { createProductMeasurementContext, paintProductPaper, productTechV1VisualSystem as v, productText } from "./visual-system";

type Definition = { count: 1 | 2 | 3; continuation: boolean; id: string };
const templateFor = (definition: Definition): AuthoredPageTemplate<ProductUseCasesPageContent> => {
  const envelope: ContentEnvelope = { slots: [
    ...(!definition.continuation ? [
      { id: "heading", path: "heading", kind: "text" as const, required: true, fontFamily: "helvetica", fontStyle: "bold" as const, fontSize: 25, widthMm: 130, maxLines: 2 },
      { id: "supportingLine", path: "supportingLine", kind: "text" as const, required: false, fontFamily: "helvetica", fontStyle: "normal" as const, fontSize: 9.25, widthMm: 130, maxLines: 3 },
    ] : []),
    { id: "useCases", path: "useCases", kind: "collection", required: true, minItems: definition.count, maxItems: definition.count },
    ...Array.from({ length: definition.count }, (_, index) => [
      { id: `useCase${index}Title`, path: `useCases.${index}.title`, kind: "text" as const, required: true, fontFamily: "helvetica", fontStyle: "bold" as const, fontSize: 15, widthMm: 62, maxLines: 2 },
      { id: `useCase${index}Description`, path: `useCases.${index}.description`, kind: "text" as const, required: true, fontFamily: "helvetica", fontStyle: "normal" as const, fontSize: 8.5, widthMm: 81, maxLines: 5 },
    ]).flat(),
  ] };
  return {
    id: definition.id, pageRole: definition.continuation ? "continuation" : "capabilities", family: "product_use_cases", priority: 90, envelope,
    prepare: (input) => evaluateContentEnvelope(definition.id, envelope, input, createProductMeasurementContext(), input.useCases.map((useCase) => useCase.contentId)),
    render: (pdf, instance): TemplateRenderAudit => {
      paintProductPaper(pdf); const audit: Record<string, readonly string[]> = {};
      pdf.setTextColor(...v.palette.electric); pdf.setFont("courier", "bold"); pdf.setFontSize(7.5); pdf.text(definition.continuation ? "USE CASES / CONTINUED" : "03 / USE CASES", 19, 24);
      if (definition.continuation) {
        pdf.setTextColor(...v.palette.ink); pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.text("ADDITIONAL USE CASES", 19, 64);
      } else {
        const heading = productText(instance, "heading"); const support = productText(instance, "supportingLine"); audit.heading = heading.lines; audit.supportingLine = support.lines;
        pdf.setTextColor(...v.palette.ink); pdf.setFont("helvetica", "bold"); pdf.setFontSize(25); pdf.setLineHeightFactor(1); pdf.text([...heading.lines], 19, 59);
        pdf.setTextColor(...v.palette.secondary); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.25); pdf.setLineHeightFactor(1.35); pdf.text([...support.lines], 19, 84);
      }
      const top = 111; const rowHeight = 158 / definition.count;
      instance.source.useCases.forEach((useCase, index) => {
        const y = top + index * rowHeight; if (index === 0) pdf.setDrawColor(...v.palette.electric); else pdf.setDrawColor(...v.palette.line); pdf.setLineWidth(index === 0 ? 0.8 : 0.35); pdf.line(19, y, 191, y);
        pdf.setTextColor(...v.palette.electric); pdf.setFont("courier", "bold"); pdf.setFontSize(8); pdf.text(useCase.index, 19, y + 16);
        const title = productText(instance, `useCase${index}Title`); const description = productText(instance, `useCase${index}Description`); audit[`useCase${index}Title`] = title.lines; audit[`useCase${index}Description`] = description.lines;
        pdf.setTextColor(...v.palette.ink); pdf.setFont("helvetica", "bold"); pdf.setFontSize(15); pdf.setLineHeightFactor(1); pdf.text([...title.lines], 42, y + 16);
        pdf.setTextColor(...v.palette.secondary); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.5); pdf.setLineHeightFactor(1.3); pdf.text([...description.lines], 110, y + 15);
      });
      pdf.setDrawColor(...v.palette.line); pdf.line(19, 269, 191, 269);
      return { templateId: definition.id, renderedTextBySlot: audit };
    },
  };
};
export const productUseCasePrimaryTemplates = ([1, 2, 3] as const).map((count) => templateFor({ count, continuation: false, id: `product-tech-v1.use-cases-${count}` }));
export const productUseCaseContinuationTemplates = ([1, 2, 3] as const).map((count) => templateFor({ count, continuation: true, id: `product-tech-v1.use-cases-continuation-${count}` }));
