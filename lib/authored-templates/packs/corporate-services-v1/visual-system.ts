import { jsPDF } from "jspdf";
import { createJsPDFMeasurementContext } from "../../content-envelope";
import type { MeasurementContext, PreparedTextSlot, TemplateInstance, TemplatePackVisualSystem } from "../../types";

export const corporateServicesV1VisualSystem = {
  page: { width: 210, height: 297, unit: "mm" },
  fonts: {
    display: { family: "times", style: "bold", size: 38 },
    headline: { family: "times", style: "bold", size: 29 },
    service: { family: "times", style: "bold", size: 17 },
    eyebrow: { family: "helvetica", style: "bold", size: 7.5 },
    body: { family: "helvetica", style: "normal", size: 9.5 },
    caption: { family: "helvetica", style: "normal", size: 8 },
  },
  palette: {
    paper: [247, 245, 239],
    navy: [24, 38, 55],
    ink: [31, 35, 40],
    muted: [92, 98, 103],
    cobalt: [50, 91, 133],
    mist: [225, 229, 229],
    white: [255, 255, 255],
  },
} as const satisfies TemplatePackVisualSystem;

export const createCorporateMeasurementContext = (): MeasurementContext => createJsPDFMeasurementContext(new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" }));

export const paintCorporatePaper = (pdf: jsPDF) => {
  pdf.setFillColor(...corporateServicesV1VisualSystem.palette.paper);
  pdf.rect(0, 0, 210, 297, "F");
};

export const preparedCorporateText = <T extends object>(instance: TemplateInstance<T>, slotId: string): PreparedTextSlot => {
  const slot = instance.preparedSlots[slotId];
  if (!slot || slot.kind !== "text") throw new Error(`Prepared text slot ${slotId} is unavailable.`);
  return slot;
};
