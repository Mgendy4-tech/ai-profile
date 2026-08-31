import { evaluateContentEnvelope } from "../../content-envelope";
import type { AuthoredPageTemplate, ContentEnvelope, TemplateRenderAudit } from "../../types";
import type { ProductFeaturesPageContent } from "./content";
import { createProductMeasurementContext, paintProductPaper, productTechV1VisualSystem as v, productText } from "./visual-system";

type Definition = { count: 1 | 2 | 3 | 4; continuation: boolean; id: string };
export type ProductFeatureCell = { x: number; y: number; bottom: number };
const PRIMARY_CELLS: readonly ProductFeatureCell[] = [
  { x: 19, y: 120, bottom: 190 }, { x: 110, y: 120, bottom: 190 }, { x: 19, y: 202, bottom: 274 }, { x: 110, y: 202, bottom: 274 },
] as const;
type FeaturePageGeometry = { cells: readonly ProductFeatureCell[]; horizontalRules: readonly number[]; verticalRules: readonly { x: number; y1: number; y2: number }[] };
const FOUR_GRID: FeaturePageGeometry = { cells: PRIMARY_CELLS, horizontalRules: [108, 190, 274], verticalRules: [{ x: 100, y1: 108, y2: 274 }] };
export const PRODUCT_FEATURE_CONTINUATION_GEOMETRY: Readonly<Record<1 | 2 | 3 | 4, FeaturePageGeometry>> = {
  1: { cells: [{ x: 61, y: 160, bottom: 274 }], horizontalRules: [108, 274], verticalRules: [{ x: 52, y1: 108, y2: 274 }, { x: 158, y1: 108, y2: 274 }] },
  2: { cells: [{ x: 19, y: 160, bottom: 274 }, { x: 110, y: 160, bottom: 274 }], horizontalRules: [108, 274], verticalRules: [{ x: 100, y1: 108, y2: 274 }] },
  3: { cells: [{ x: 61, y: 126, bottom: 190 }, { x: 19, y: 210, bottom: 274 }, { x: 110, y: 210, bottom: 274 }], horizontalRules: [108, 190, 274], verticalRules: [{ x: 52, y1: 108, y2: 190 }, { x: 158, y1: 108, y2: 190 }, { x: 100, y1: 190, y2: 274 }] },
  4: FOUR_GRID,
};

const templateFor = (definition: Definition): AuthoredPageTemplate<ProductFeaturesPageContent> => {
  const envelope: ContentEnvelope = { slots: [
    ...(!definition.continuation ? [
      { id: "heading", path: "heading", kind: "text" as const, required: true, fontFamily: "helvetica", fontStyle: "bold" as const, fontSize: 25, widthMm: 130, maxLines: 2 },
      { id: "supportingLine", path: "supportingLine", kind: "text" as const, required: false, fontFamily: "helvetica", fontStyle: "normal" as const, fontSize: 9.25, widthMm: 130, maxLines: 3 },
    ] : []),
    { id: "features", path: "features", kind: "collection", required: true, minItems: definition.count, maxItems: definition.count },
    ...Array.from({ length: definition.count }, (_, index) => [
      { id: `feature${index}Title`, path: `features.${index}.title`, kind: "text" as const, required: true, fontFamily: "helvetica", fontStyle: "bold" as const, fontSize: 14, widthMm: 70, maxLines: 2 },
      { id: `feature${index}Description`, path: `features.${index}.description`, kind: "text" as const, required: true, fontFamily: "helvetica", fontStyle: "normal" as const, fontSize: 8.25, widthMm: 70, maxLines: 6 },
    ]).flat(),
  ] };
  return {
    id: definition.id, pageRole: definition.continuation ? "continuation" : "capabilities", family: "product_features", priority: 100, envelope,
    prepare: (input) => evaluateContentEnvelope(definition.id, envelope, input, createProductMeasurementContext(), input.features.map((feature) => feature.contentId)),
    render: (pdf, instance): TemplateRenderAudit => {
      paintProductPaper(pdf); const audit: Record<string, readonly string[]> = {};
      const geometry = definition.continuation ? PRODUCT_FEATURE_CONTINUATION_GEOMETRY[definition.count] : FOUR_GRID;
      pdf.setFillColor(...v.palette.ink); pdf.rect(0, 0, 210, 34, "F"); pdf.setFillColor(...v.palette.signal); pdf.rect(176, 16, 15, 2.5, "F");
      pdf.setTextColor(...v.palette.white); pdf.setFont("courier", "bold"); pdf.setFontSize(7.5); pdf.text(definition.continuation ? "FEATURES / CONTINUED" : "02 / FEATURES", 19, 21);
      if (definition.continuation) {
        pdf.setTextColor(...v.palette.ink); pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.text("MORE CAPABILITIES", 19, 67);
      } else {
        const heading = productText(instance, "heading"); const support = productText(instance, "supportingLine"); audit.heading = heading.lines; audit.supportingLine = support.lines;
        pdf.setTextColor(...v.palette.ink); pdf.setFont("helvetica", "bold"); pdf.setFontSize(25); pdf.setLineHeightFactor(1); pdf.text([...heading.lines], 19, 62);
        pdf.setTextColor(...v.palette.secondary); pdf.setFont("helvetica", "normal"); pdf.setFontSize(9.25); pdf.setLineHeightFactor(1.35); pdf.text([...support.lines], 19, 88);
      }
      pdf.setDrawColor(...v.palette.line); pdf.setLineWidth(0.35); geometry.horizontalRules.forEach((y) => pdf.line(19, y, 191, y)); geometry.verticalRules.forEach((rule) => pdf.line(rule.x, rule.y1, rule.x, rule.y2));
      instance.source.features.forEach((feature, index) => {
        const cell = geometry.cells[index]; const title = productText(instance, `feature${index}Title`); const description = productText(instance, `feature${index}Description`); audit[`feature${index}Title`] = title.lines; audit[`feature${index}Description`] = description.lines;
        pdf.setTextColor(...v.palette.electric); pdf.setFont("courier", "bold"); pdf.setFontSize(7.5); pdf.text(feature.index, cell.x, cell.y);
        pdf.setTextColor(...v.palette.ink); pdf.setFont("helvetica", "bold"); pdf.setFontSize(14); pdf.setLineHeightFactor(1); pdf.text([...title.lines], cell.x, cell.y + 14);
        pdf.setTextColor(...v.palette.secondary); pdf.setFont("helvetica", "normal"); pdf.setFontSize(8.25); pdf.setLineHeightFactor(1.3); pdf.text([...description.lines], cell.x, cell.y + 34);
      });
      return { templateId: definition.id, renderedTextBySlot: audit };
    },
  };
};
export const productFeaturePrimaryTemplates = ([1, 2, 3, 4] as const).map((count) => templateFor({ count, continuation: false, id: `product-tech-v1.features-${count}` }));
export const productFeatureContinuationTemplates = ([1, 2, 3, 4] as const).map((count) => templateFor({ count, continuation: true, id: `product-tech-v1.features-continuation-${count}` }));
