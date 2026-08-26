import type { jsPDF } from "jspdf";
import { evaluateContentEnvelope } from "../../content-envelope";
import type {
  AuthoredPageTemplate,
  ContentEnvelope,
  PreparedTextSlot,
  TemplateInstance,
  TemplateRenderAudit,
} from "../../types";
import type { CapabilitiesContent } from "./content";
import {
  createEditorialInteriorsMeasurementContext,
  editorialInteriorsV1VisualSystem as visual,
  getPreparedText,
  paintPaper,
} from "./visual-system";

const textSlot = (
  id: string,
  path: string,
  fontFamily: string,
  fontStyle: "normal" | "bold" | "italic" | "bolditalic",
  fontSize: number,
  widthMm: number,
  maxLines: number,
  required = true,
) => ({
  id,
  path,
  kind: "text" as const,
  required,
  fontFamily,
  fontStyle,
  fontSize,
  widthMm,
  maxLines,
});

export const capabilitiesEnvelope: ContentEnvelope = {
  slots: [
    textSlot("eyebrow", "eyebrow", "helvetica", "bold", 7.5, 55, 1),
    textSlot("heading", "heading", "times", "normal", 32, 172, 1),
    textSlot("supportingLine", "supportingLine", "helvetica", "normal", 9, 128, 2),
    ...([0, 1, 2, 3] as const).flatMap((capabilityIndex) => [
      textSlot(`capability${capabilityIndex}Index`, `capabilities.${capabilityIndex}.index`, "times", "normal", 25, 16, 1),
      textSlot(`capability${capabilityIndex}Title`, `capabilities.${capabilityIndex}.title`, "times", "bold", 15, 70, 2),
      textSlot(`capability${capabilityIndex}Description`, `capabilities.${capabilityIndex}.description`, "helvetica", "normal", 8.8, 70, 4),
      {
        id: `capability${capabilityIndex}Items`,
        path: `capabilities.${capabilityIndex}.items`,
        kind: "collection" as const,
        required: true,
        minItems: 0,
        maxItems: 3,
      },
      textSlot(`capability${capabilityIndex}Item0`, `capabilities.${capabilityIndex}.items.0`, "helvetica", "normal", 7.5, 66, 1, false),
      textSlot(`capability${capabilityIndex}Item1`, `capabilities.${capabilityIndex}.items.1`, "helvetica", "normal", 7.5, 66, 1, false),
      textSlot(`capability${capabilityIndex}Item2`, `capabilities.${capabilityIndex}.items.2`, "helvetica", "normal", 7.5, 66, 1, false),
    ]),
  ],
};

const prepare = (input: CapabilitiesContent) => evaluateContentEnvelope(
  "editorial-interiors-v1.capabilities",
  capabilitiesEnvelope,
  input,
  createEditorialInteriorsMeasurementContext(),
  [input.contentId],
);

const prepareWithMarkers = (input: CapabilitiesContent) => {
  const result = prepare(input);
  if (!result.compatible) return result;
  const preparedSlots = { ...result.instance.preparedSlots };
  ([0, 1, 2, 3] as const).forEach((capabilityIndex) => {
    ([0, 1, 2] as const).forEach((itemIndex) => {
      const slotId = `capability${capabilityIndex}Item${itemIndex}`;
      const slot = preparedSlots[slotId];
      if (slot?.kind === "text") {
        preparedSlots[slotId] = {
          ...slot,
          lines: slot.lines.map((line) => `/  ${line}`),
        };
      }
    });
  });
  return {
    ...result,
    instance: { ...result.instance, preparedSlots },
  };
};

const render = (
  pdf: jsPDF,
  instance: TemplateInstance<CapabilitiesContent>,
): TemplateRenderAudit => {
  paintPaper(pdf);
  const renderedTextBySlot: Record<string, readonly string[]> = {};
  const draw = (slotId: string, x: number, y: number) => {
    const prepared = getPreparedText(instance, slotId);
    pdf.text([...prepared.lines], x, y);
    renderedTextBySlot[slotId] = prepared.lines;
  };

  pdf.setTextColor(...visual.palette.secondary);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setCharSpace(visual.eyebrow.characterSpacing);
  draw("eyebrow", 19, 25);
  pdf.setCharSpace(0);
  pdf.setTextColor(...visual.palette.charcoal);
  pdf.setFont("times", "normal");
  pdf.setFontSize(32);
  draw("heading", 19, 49);
  pdf.setTextColor(...visual.palette.secondary);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  draw("supportingLine", 19, 61);

  const origins = [
    { x: 19, y: 87 }, { x: 109, y: 87 },
    { x: 19, y: 184 }, { x: 109, y: 184 },
  ] as const;

  origins.forEach(({ x, y }, capabilityIndex) => {
    pdf.setDrawColor(...visual.palette.hairline);
    pdf.setLineWidth(0.25);
    pdf.line(x, y, x + 82, y);
    pdf.setTextColor(...visual.palette.ochre);
    pdf.setFont("times", "normal");
    pdf.setFontSize(25);
    draw(`capability${capabilityIndex}Index`, x, y + 17);
    pdf.setTextColor(...visual.palette.charcoal);
    pdf.setFont("times", "bold");
    pdf.setFontSize(15);
    draw(`capability${capabilityIndex}Title`, x, y + 31);
    pdf.setTextColor(...visual.palette.secondary);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.8);
    pdf.setLineHeightFactor(1.4);
    draw(`capability${capabilityIndex}Description`, x, y + 45);
    pdf.setFontSize(7.5);
    ([0, 1, 2] as const).forEach((itemIndex) => {
      const slotId = `capability${capabilityIndex}Item${itemIndex}`;
      const prepared = instance.preparedSlots[slotId] as PreparedTextSlot | undefined;
      if (!prepared || prepared.kind !== "text") return;
      const itemY = y + 69 + itemIndex * 7;
      pdf.text([...prepared.lines], x, itemY);
      renderedTextBySlot[slotId] = prepared.lines;
    });
  });

  return { templateId: instance.templateId, renderedTextBySlot };
};

export const editorialInteriorsCapabilitiesTemplate: AuthoredPageTemplate<CapabilitiesContent> = {
  id: "editorial-interiors-v1.capabilities",
  pageRole: "capabilities",
  family: "editorial_capabilities",
  priority: 100,
  envelope: capabilitiesEnvelope,
  prepare: prepareWithMarkers,
  render,
};
