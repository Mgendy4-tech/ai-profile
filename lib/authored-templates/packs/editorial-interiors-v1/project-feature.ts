import type { jsPDF } from "jspdf";
import { evaluateContentEnvelope } from "../../content-envelope";
import type {
  AuthoredPageTemplate,
  ContentEnvelope,
  TemplateInstance,
  TemplateRenderAudit,
} from "../../types";
import type { ProjectFeatureContent } from "./content";
import { coverCrop } from "./portfolio-project-pages";
import {
  clipAndDrawImage,
  createEditorialInteriorsMeasurementContext,
  editorialInteriorsV1VisualSystem as visual,
  getPreparedImage,
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

export const projectFeatureEnvelope: ContentEnvelope = {
  slots: [
    textSlot("title", "title", "times", "normal", 30, 172, 1),
    {
      id: "hero",
      path: "hero",
      kind: "image",
      required: true,
      allowedRoles: ["project_image"],
      allowedProvenances: ["user_upload", "ai_generated_fictional_poc_test_asset"],
      minimumAspectRatio: visual.crops.projectFeature.sourceAspectRange.minimum,
      maximumAspectRatio: 1.5,
    },
    ...([0, 1, 2] as const).flatMap((index) => [
      textSlot(`info${index}Label`, `info.${index}.label`, "helvetica", "bold", 6.8, 48, 1, false),
      textSlot(`info${index}Value`, `info.${index}.value`, "helvetica", "normal", 8.5, 48, 2, false),
    ]),
    textSlot("overviewBody", "overviewBody", "helvetica", "normal", 8.8, 90, 6),
    textSlot("scopeTitle", "scope.title", "times", "bold", 12, 65, 1, false),
    ...([0, 1, 2] as const).map((index) =>
      textSlot(`scopeItem${index}`, `scope.items.${index}`, "helvetica", "normal", 8, 65, 2, false)),
  ],
};

const prepare = (input: ProjectFeatureContent) => evaluateContentEnvelope(
  "editorial-interiors-v1.project-feature",
  projectFeatureEnvelope,
  input,
  createEditorialInteriorsMeasurementContext(),
  [input.contentId],
);

const prepareWithMarkers = (input: ProjectFeatureContent) => {
  const result = prepare(input);
  if (!result.compatible) return result;
  const preparedSlots = { ...result.instance.preparedSlots };
  ([0, 1, 2] as const).forEach((index) => {
    const slotId = `scopeItem${index}`;
    const slot = preparedSlots[slotId];
    if (slot?.kind === "text") {
      preparedSlots[slotId] = {
        ...slot,
        lines: slot.lines.map((line) => `/  ${line}`),
      };
    }
  });
  return {
    ...result,
    instance: { ...result.instance, preparedSlots },
  };
};

const render = (
  pdf: jsPDF,
  instance: TemplateInstance<ProjectFeatureContent>,
): TemplateRenderAudit => {
  paintPaper(pdf);
  const hero = getPreparedImage(instance, "hero");
  clipAndDrawImage(
    pdf,
    hero.source.source,
    hero.source.format,
    visual.crops.projectFeature.frame,
    coverCrop(visual.crops.projectFeature.frame, hero.aspectRatio),
  );

  const renderedTextBySlot: Record<string, readonly string[]> = {};
  const draw = (slotId: string, x: number, y: number) => {
    const prepared = getPreparedText(instance, slotId);
    pdf.text([...prepared.lines], x, y);
    renderedTextBySlot[slotId] = prepared.lines;
  };

  pdf.setDrawColor(...visual.palette.ochre);
  pdf.setLineWidth(visual.rule.lineWidth);
  pdf.line(19, 158, 42, 158);
  pdf.setTextColor(...visual.palette.secondary);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setCharSpace(visual.eyebrow.characterSpacing);
  pdf.text("03 / FEATURE", 19, 171);
  pdf.setCharSpace(0);
  pdf.setTextColor(...visual.palette.charcoal);
  pdf.setFont("times", "normal");
  pdf.setFontSize(30);
  draw("title", 19, 192);

  const infoX = [19, 80, 141] as const;
  infoX.forEach((x, index) => {
    pdf.setTextColor(...visual.palette.secondary);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.8);
    if (!instance.preparedSlots[`info${index}Label`]) return;
    draw(`info${index}Label`, x, 211);
    pdf.setTextColor(...visual.palette.charcoal);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    draw(`info${index}Value`, x, 219);
  });

  pdf.setDrawColor(...visual.palette.hairline);
  pdf.setLineWidth(0.25);
  pdf.line(19, 231, 191, 231);
  pdf.setTextColor(...visual.palette.charcoal);
  pdf.setFont("times", "bold");
  pdf.setFontSize(12);
  pdf.text("Overview", 19, 246);
  pdf.setTextColor(...visual.palette.secondary);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.8);
  pdf.setLineHeightFactor(1.42);
  draw("overviewBody", 19, 256);
  pdf.setTextColor(...visual.palette.charcoal);
  pdf.setFont("times", "bold");
  pdf.setFontSize(12);
  if (instance.preparedSlots.scopeTitle) draw("scopeTitle", 126, 246);
  pdf.setTextColor(...visual.palette.secondary);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  ([0, 1, 2] as const).forEach((index) => {
    const slotId = `scopeItem${index}`;
    const preparedSlot = instance.preparedSlots[slotId];
    if (!preparedSlot) return;
    const prepared = getPreparedText(instance, slotId);
    const itemY = 257 + index * 8;
    pdf.text([...prepared.lines], 126, itemY);
    renderedTextBySlot[slotId] = prepared.lines;
  });

  return { templateId: instance.templateId, renderedTextBySlot };
};

export const editorialInteriorsProjectFeatureTemplate: AuthoredPageTemplate<ProjectFeatureContent> = {
  id: "editorial-interiors-v1.project-feature",
  pageRole: "project_feature",
  family: "editorial_project_feature",
  priority: 100,
  envelope: projectFeatureEnvelope,
  prepare: prepareWithMarkers,
  render,
};
