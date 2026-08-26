import { jsPDF } from "jspdf";
import { createJsPDFMeasurementContext } from "../../content-envelope";
import type { MeasurementContext, PreparedTextSlot, TemplateInstance, TemplatePackVisualSystem } from "../../types";

export const productTechV1VisualSystem = {
  page: { width: 210, height: 297, unit: "mm" },
  fonts: {
    display: { family: "helvetica", style: "bold", size: 35 },
    headline: { family: "helvetica", style: "bold", size: 25 },
    feature: { family: "helvetica", style: "bold", size: 14 },
    label: { family: "courier", style: "bold", size: 7.5 },
    body: { family: "helvetica", style: "normal", size: 9.25 },
    caption: { family: "helvetica", style: "normal", size: 8 },
  },
  palette: {
    paper: [247, 249, 251],
    ink: [12, 19, 29],
    secondary: [73, 84, 98],
    electric: [65, 99, 235],
    signal: [164, 224, 92],
    line: [199, 208, 220],
    white: [255, 255, 255],
  },
} as const satisfies TemplatePackVisualSystem;

export const createProductMeasurementContext = (): MeasurementContext => createJsPDFMeasurementContext(new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" }));
export const paintProductPaper = (pdf: jsPDF) => { pdf.setFillColor(...productTechV1VisualSystem.palette.paper); pdf.rect(0, 0, 210, 297, "F"); };
export const productText = <T extends object>(instance: TemplateInstance<T>, slotId: string): PreparedTextSlot => { const slot = instance.preparedSlots[slotId]; if (!slot || slot.kind !== "text") throw new Error(`Prepared text slot ${slotId} is unavailable.`); return slot; };
