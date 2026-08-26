import { jsPDF } from "jspdf";
import { createJsPDFMeasurementContext } from "../../content-envelope";
import type {
  MeasurementContext,
  PreparedImageSlot,
  PreparedTextSlot,
  TemplateInstance,
  TemplatePackVisualSystem,
} from "../../types";

export const editorialInteriorsV1VisualSystem = {
  page: { width: 210, height: 297, unit: "mm" },
  fonts: {
    coverTitle: { family: "times", style: "normal", size: 52 },
    display: { family: "times", style: "normal", size: 34 },
    displayItalic: { family: "times", style: "italic", size: 19 },
    heading: { family: "times", style: "bold", size: 15 },
    eyebrow: { family: "helvetica", style: "bold", size: 7.5 },
    body: { family: "helvetica", style: "normal", size: 10 },
    caption: { family: "helvetica", style: "normal", size: 8 },
  },
  palette: {
    paper: [242, 238, 229],
    charcoal: [25, 24, 22],
    secondary: [75, 71, 65],
    ochre: [156, 108, 71],
    hairline: [181, 174, 162],
  },
  eyebrow: {
    x: 19,
    y: 25,
    characterSpacing: 0.45,
  },
  rule: {
    width: 23,
    lineWidth: 0.7,
  },
  crops: {
    cover: {
      frame: { x: 0, y: 0, width: 122, height: 297 },
      image: { x: -35.6, y: 0, width: 210.16, height: 297 },
      sourceAspectRange: { minimum: 0.65, maximum: 0.8 },
    },
    projectFeature: {
      frame: { x: 0, y: 0, width: 210, height: 150 },
      image: { x: 0, y: -35, width: 210, height: 296.7 },
      sourceAspectRange: { minimum: 0.65, maximum: 0.8 },
    },
  },
} as const satisfies TemplatePackVisualSystem & {
  eyebrow: { x: number; y: number; characterSpacing: number };
  rule: { width: number; lineWidth: number };
  crops: {
    cover: {
      frame: { x: number; y: number; width: number; height: number };
      image: { x: number; y: number; width: number; height: number };
      sourceAspectRange: { minimum: number; maximum: number };
    };
    projectFeature: {
      frame: { x: number; y: number; width: number; height: number };
      image: { x: number; y: number; width: number; height: number };
      sourceAspectRange: { minimum: number; maximum: number };
    };
  };
};

export const createEditorialInteriorsMeasurementContext = (): MeasurementContext => {
  const measurementPdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  return createJsPDFMeasurementContext(measurementPdf);
};

export const paintPaper = (pdf: jsPDF) => {
  pdf.setFillColor(...editorialInteriorsV1VisualSystem.palette.paper);
  pdf.rect(0, 0, 210, 297, "F");
};

export const getPreparedText = <TSource extends object>(
  instance: TemplateInstance<TSource>,
  slotId: string,
): PreparedTextSlot => {
  const slot = instance.preparedSlots[slotId];
  if (!slot || slot.kind !== "text") {
    throw new Error(`Prepared text slot ${slotId} is unavailable.`);
  }
  return slot;
};

export const getPreparedImage = <TSource extends object>(
  instance: TemplateInstance<TSource>,
  slotId: string,
): PreparedImageSlot => {
  const slot = instance.preparedSlots[slotId];
  if (!slot || slot.kind !== "image") {
    throw new Error(`Prepared image slot ${slotId} is unavailable.`);
  }
  return slot;
};

export const clipAndDrawImage = (
  pdf: jsPDF,
  source: string,
  format: "PNG" | "JPEG",
  frame: { x: number; y: number; width: number; height: number },
  image: { x: number; y: number; width: number; height: number },
) => {
  pdf.saveGraphicsState();
  pdf.rect(frame.x, frame.y, frame.width, frame.height, null);
  pdf.clip();
  pdf.discardPath();
  pdf.addImage(source, format, image.x, image.y, image.width, image.height);
  pdf.restoreGraphicsState();
};
