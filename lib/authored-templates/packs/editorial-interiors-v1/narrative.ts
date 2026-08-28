import type { jsPDF } from "jspdf";
import { evaluateContentEnvelope } from "../../content-envelope";
import type { AuthoredPageTemplate, ContentEnvelope, TemplateInstance, TemplateRenderAudit } from "../../types";
import type { NarrativeContent } from "./content";
import {
  createEditorialInteriorsMeasurementContext,
  editorialInteriorsV1VisualSystem as visual,
  getPreparedText,
  paintPaper,
} from "./visual-system";

const singleLine = (
  id: string,
  path: string,
  font: { family: string; style: "normal" | "bold" | "italic" | "bolditalic"; size: number },
  widthMm: number,
) => ({
  id,
  path,
  kind: "text" as const,
  required: true,
  fontFamily: font.family,
  fontStyle: font.style,
  fontSize: font.size,
  widthMm,
  maxLines: 1,
});

export const narrativeEnvelope: ContentEnvelope = {
  slots: [
    { ...singleLine("title", "title", visual.fonts.display, 172), maxLines: 2 },
    { ...singleLine("callout", "callout.text", visual.fonts.displayItalic, 53), maxLines: 4, required: false },
    {
      ...singleLine("calloutLabel", "callout.label", { family: "helvetica", style: "bold", size: 7 }, 53),
      maxLines: 2,
      required: false,
    },
    { id: "body", path: "body", kind: "text", required: true, fontFamily: "helvetica", fontStyle: "normal", fontSize: 10, widthMm: 103, maxLines: 8 },
    { ...singleLine("secondaryTitle", "secondaryBlock.title", { family: "times", style: "bold", size: 13 }, 103), required: false },
    { id: "secondaryBody", path: "secondaryBlock.body", kind: "text", required: false, fontFamily: "helvetica", fontStyle: "normal", fontSize: 10, widthMm: 103, maxLines: 8 },
  ],
};

export const sparseNarrativeEnvelope: ContentEnvelope = {
  slots: [
    { ...singleLine("title", "title", visual.fonts.display, 172), maxLines: 2 },
    { id: "body", path: "body", kind: "text", required: true, fontFamily: "helvetica", fontStyle: "normal", fontSize: 10, widthMm: 103, maxLines: 6 },
  ],
};

const sparseFactsEnvelope = (count: 2 | 3): ContentEnvelope => ({
  slots: [
    { ...singleLine("title", "title", visual.fonts.display, 172), maxLines: 2 },
    { id: "body", path: "body", kind: "text", required: true, fontFamily: "helvetica", fontStyle: "normal", fontSize: 10, widthMm: 103, maxLines: 6 },
    { id: "facts", path: "facts", kind: "collection", required: true, minItems: count, maxItems: count },
    ...Array.from({ length: count }, (_, index) => [
      { id: `fact${index}Value`, path: `facts.${index}.value`, kind: "text" as const, required: true, fontFamily: "times", fontStyle: "bold" as const, fontSize: 13, widthMm: count === 3 ? 48 : 70, maxLines: 4 },
      { id: `fact${index}Label`, path: `facts.${index}.label`, kind: "text" as const, required: true, fontFamily: "helvetica", fontStyle: "bold" as const, fontSize: 7, widthMm: count === 3 ? 48 : 70, maxLines: 1 },
    ]).flat(),
  ],
});

const prepareFor = (templateId: string, envelope: ContentEnvelope, input: NarrativeContent) => evaluateContentEnvelope(
  templateId,
  envelope,
  input,
  createEditorialInteriorsMeasurementContext(),
  [input.contentId],
);

const renderStandard = (
  pdf: jsPDF,
  instance: TemplateInstance<NarrativeContent>,
): TemplateRenderAudit => {
  paintPaper(pdf);
  const renderedTextBySlot: Record<string, readonly string[]> = {};
  const draw = (slotId: string, x: number, y: number) => {
    const prepared = getPreparedText(instance, slotId);
    pdf.text([...prepared.lines], x, y);
    renderedTextBySlot[slotId] = prepared.lines;
  };

  pdf.setTextColor(...visual.palette.charcoal);
  pdf.setFont("times", "normal");
  pdf.setFontSize(34);
  pdf.setLineHeightFactor(12 / (34 * 0.352778));
  draw("title", 19, 53);
  pdf.setDrawColor(...visual.palette.ochre);
  pdf.setLineWidth(visual.rule.lineWidth);
  pdf.line(19, 86, 42, 86);
  pdf.setTextColor(...visual.palette.charcoal);
  pdf.setFont("times", "italic");
  pdf.setFontSize(19);
  pdf.setLineHeightFactor(8 / (19 * 0.352778));
  if (instance.preparedSlots.callout) draw("callout", 19, 109);
  if (instance.preparedSlots.calloutLabel) {
    pdf.setTextColor(...visual.palette.secondary);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    draw("calloutLabel", 19, 151);
  }

  pdf.setTextColor(...visual.palette.secondary);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setLineHeightFactor(1.48);
  draw("body", 88, 104);
  if (instance.preparedSlots.secondaryTitle) {
    pdf.setTextColor(...visual.palette.charcoal);
    pdf.setFont("times", "bold");
    pdf.setFontSize(13);
    draw("secondaryTitle", 88, 171);
  }
  if (instance.preparedSlots.secondaryBody) {
    pdf.setTextColor(...visual.palette.secondary);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setLineHeightFactor(1.48);
    draw("secondaryBody", 88, instance.preparedSlots.secondaryTitle ? 182 : 171);
  }

  return { templateId: instance.templateId, renderedTextBySlot };
};

export const editorialInteriorsNarrativeTemplate: AuthoredPageTemplate<NarrativeContent> = {
  id: "editorial-interiors-v1.narrative",
  pageRole: "narrative",
  family: "editorial_narrative",
  priority: 100,
  envelope: narrativeEnvelope,
  prepare: (input) => prepareFor("editorial-interiors-v1.narrative", narrativeEnvelope, input),
  render: renderStandard,
};

const renderSparse = (pdf: jsPDF, instance: TemplateInstance<NarrativeContent>): TemplateRenderAudit => {
  paintPaper(pdf);
  const title = getPreparedText(instance, "title");
  const body = getPreparedText(instance, "body");
  pdf.setTextColor(...visual.palette.charcoal);
  pdf.setFont("times", "normal");
  pdf.setFontSize(34);
  pdf.setLineHeightFactor(12 / (34 * 0.352778));
  pdf.text([...title.lines], 19, 53);
  pdf.setDrawColor(...visual.palette.ochre);
  pdf.setLineWidth(visual.rule.lineWidth);
  pdf.line(19, 86, 42, 86);
  pdf.setTextColor(...visual.palette.secondary);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setCharSpace(visual.eyebrow.characterSpacing);
  pdf.text("01 / ABOUT", 19, 112);
  pdf.setCharSpace(0);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(10);
  pdf.setLineHeightFactor(1.48);
  pdf.text([...body.lines], 88, 116);
  pdf.setDrawColor(...visual.palette.hairline);
  pdf.setLineWidth(0.25);
  pdf.line(88, 169, 191, 169);
  pdf.setTextColor(...visual.palette.ochre);
  pdf.setFont("times", "normal");
  pdf.setFontSize(72);
  pdf.text("01", 19, 229);
  pdf.setTextColor(...visual.palette.secondary);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setCharSpace(0.7);
  pdf.text("A CONSIDERED POINT OF VIEW", 88, 190);
  pdf.setCharSpace(0);
  return { templateId: instance.templateId, renderedTextBySlot: { title: title.lines, body: body.lines } };
};

export const editorialInteriorsSparseNarrativeTemplate: AuthoredPageTemplate<NarrativeContent> = {
  id: "editorial-interiors-v1.narrative-sparse",
  pageRole: "narrative",
  family: "editorial_narrative",
  priority: 101,
  envelope: sparseNarrativeEnvelope,
  prepare: (input) => prepareFor("editorial-interiors-v1.narrative-sparse", sparseNarrativeEnvelope, input),
  render: renderSparse,
};

const createSparseFactsTemplate = (count: 2 | 3): AuthoredPageTemplate<NarrativeContent> => {
  const templateId = `editorial-interiors-v1.narrative-sparse-facts-${count}`;
  const envelope = sparseFactsEnvelope(count);
  return {
    id: templateId,
    pageRole: "narrative",
    family: "editorial_narrative",
    priority: 102 + count,
    envelope,
    prepare: (input) => prepareFor(templateId, envelope, input),
    render: (pdf, instance): TemplateRenderAudit => {
      paintPaper(pdf);
      const audit: Record<string, readonly string[]> = {};
      const draw = (slotId: string, x: number, y: number) => {
        const prepared = getPreparedText(instance, slotId);
        pdf.text([...prepared.lines], x, y);
        audit[slotId] = prepared.lines;
      };
      pdf.setTextColor(...visual.palette.charcoal);
      pdf.setFont("times", "normal");
      pdf.setFontSize(34);
      pdf.setLineHeightFactor(12 / (34 * 0.352778));
      draw("title", 19, 53);
      pdf.setDrawColor(...visual.palette.ochre);
      pdf.setLineWidth(visual.rule.lineWidth);
      pdf.line(19, 86, 42, 86);
      pdf.setTextColor(...visual.palette.secondary);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setCharSpace(visual.eyebrow.characterSpacing);
      pdf.text("01 / ABOUT", 19, 112);
      pdf.setCharSpace(0);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setLineHeightFactor(1.48);
      draw("body", 88, 116);
      pdf.setDrawColor(...visual.palette.hairline);
      pdf.setLineWidth(0.25);
      pdf.line(19, 183, 191, 183);
      pdf.setTextColor(...visual.palette.ochre);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setCharSpace(0.7);
      pdf.text("AT A GLANCE", 19, 199);
      pdf.setCharSpace(0);
      const origins = count === 3 ? [19, 80, 141] : [19, 111];
      origins.forEach((x, index) => {
        pdf.setTextColor(...visual.palette.charcoal);
        pdf.setFont("times", "bold");
        pdf.setFontSize(13);
        pdf.setLineHeightFactor(1.05);
        draw(`fact${index}Value`, x, 224);
        pdf.setTextColor(...visual.palette.secondary);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(7);
        pdf.setCharSpace(0.5);
        draw(`fact${index}Label`, x, 250);
        pdf.setCharSpace(0);
      });
      return { templateId: instance.templateId, renderedTextBySlot: audit };
    },
  };
};

export const editorialInteriorsSparseNarrativeFacts2Template = createSparseFactsTemplate(2);
export const editorialInteriorsSparseNarrativeFacts3Template = createSparseFactsTemplate(3);

export const selectEditorialInteriorsNarrativeTemplate = (input: NarrativeContent) =>
  !input.callout && !input.secondaryBlock
    ? editorialInteriorsSparseNarrativeTemplate.prepare(input).compatible
      ? input.facts?.length === 3
        ? editorialInteriorsSparseNarrativeFacts3Template
        : input.facts?.length === 2
          ? editorialInteriorsSparseNarrativeFacts2Template
          : editorialInteriorsSparseNarrativeTemplate
      : editorialInteriorsNarrativeTemplate
    : editorialInteriorsNarrativeTemplate;
