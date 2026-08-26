import type jsPDF from "jspdf";
import type {
  CollectionSlotEnvelope,
  ContentEnvelope,
  ContractIssue,
  ImageSlotEnvelope,
  ImageSlotValue,
  MeasurementContext,
  PreparedTemplateSlot,
  TemplateCompatibilityResult,
  TemplateSlot,
  TextSlotEnvelope,
} from "./types";

const getValueAtPath = (source: object, path: string): unknown => {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, source);
};

const isMissing = (slot: TemplateSlot, value: unknown) => {
  if (value === undefined || value === null) return true;
  if (slot.kind === "text") return typeof value === "string" && value.length === 0;
  return false;
};

const issue = (
  slot: TemplateSlot,
  code: ContractIssue["code"],
  message: string,
): ContractIssue => ({ code, path: slot.path, slotId: slot.id, message });

const prepareTextSlot = (
  slot: TextSlotEnvelope,
  value: unknown,
  measurement: MeasurementContext,
) => {
  if (typeof value !== "string") {
    return {
      issues: [issue(slot, "invalid_slot_type", "Text slot value must be a string.")],
      prepared: null,
    } as const;
  }

  const lines = [...measurement.wrapText({
    text: value,
    fontFamily: slot.fontFamily,
    fontStyle: slot.fontStyle,
    fontSize: slot.fontSize,
    widthMm: slot.widthMm,
  })];

  if (lines.length > slot.maxLines) {
    return {
      issues: [issue(
        slot,
        "text_line_limit_exceeded",
        `Text requires ${lines.length} lines; slot permits ${slot.maxLines}.`,
      )],
      prepared: null,
    } as const;
  }

  return {
    issues: [],
    prepared: { kind: "text", source: value, lines } as const,
  };
};

const prepareCollectionSlot = (
  slot: CollectionSlotEnvelope,
  value: unknown,
) => {
  if (!Array.isArray(value)) {
    return {
      issues: [issue(slot, "invalid_slot_type", "Collection slot value must be an array.")],
      prepared: null,
    } as const;
  }

  const issues: ContractIssue[] = [];
  if (value.length < slot.minItems) {
    issues.push(issue(
      slot,
      "collection_below_minimum",
      `Collection contains ${value.length} items; slot requires at least ${slot.minItems}.`,
    ));
  }
  if (value.length > slot.maxItems) {
    issues.push(issue(
      slot,
      "collection_above_maximum",
      `Collection contains ${value.length} items; slot permits at most ${slot.maxItems}.`,
    ));
  }

  return issues.length > 0
    ? { issues, prepared: null } as const
    : {
        issues: [],
        prepared: { kind: "collection", source: value } as const,
      };
};

const isImageSlotValue = (value: unknown): value is ImageSlotValue => {
  if (!value || typeof value !== "object") return false;
  const image = value as Partial<ImageSlotValue>;
  return (
    typeof image.role === "string" &&
    typeof image.provenance === "string" &&
    (image.format === "PNG" || image.format === "JPEG") &&
    typeof image.width === "number" &&
    typeof image.height === "number" &&
    typeof image.source === "string"
  );
};

const prepareImageSlot = (
  slot: ImageSlotEnvelope,
  value: unknown,
) => {
  if (!isImageSlotValue(value)) {
    return {
      issues: [issue(slot, "invalid_slot_type", "Image slot value must contain role, provenance, format, dimensions, and source.")],
      prepared: null,
    } as const;
  }

  const issues: ContractIssue[] = [];
  if (!slot.allowedRoles.includes(value.role)) {
    issues.push(issue(
      slot,
      "image_role_not_allowed",
      `Image role ${value.role} is not allowed in this slot.`,
    ));
  }
  if (!slot.allowedProvenances.includes(value.provenance)) {
    issues.push(issue(
      slot,
      "image_provenance_not_allowed",
      `Image provenance ${value.provenance} is not allowed in this slot.`,
    ));
  }

  if (
    !Number.isFinite(value.width) ||
    !Number.isFinite(value.height) ||
    value.width <= 0 ||
    value.height <= 0
  ) {
    issues.push(issue(
      slot,
      "image_dimensions_invalid",
      "Image dimensions must be finite positive numbers.",
    ));
    return { issues, prepared: null } as const;
  }

  const aspectRatio = value.width / value.height;
  if (
    slot.minimumAspectRatio !== undefined &&
    aspectRatio < slot.minimumAspectRatio
  ) {
    issues.push(issue(
      slot,
      "image_aspect_ratio_below_minimum",
      `Image aspect ratio ${aspectRatio.toFixed(4)} is below ${slot.minimumAspectRatio}.`,
    ));
  }
  if (
    slot.maximumAspectRatio !== undefined &&
    aspectRatio > slot.maximumAspectRatio
  ) {
    issues.push(issue(
      slot,
      "image_aspect_ratio_above_maximum",
      `Image aspect ratio ${aspectRatio.toFixed(4)} exceeds ${slot.maximumAspectRatio}.`,
    ));
  }

  return issues.length > 0
    ? { issues, prepared: null } as const
    : {
        issues: [],
        prepared: { kind: "image", source: value, aspectRatio } as const,
      };
};

export const createJsPDFMeasurementContext = (
  pdf: jsPDF,
): MeasurementContext => ({
  wrapText: ({ text, fontFamily, fontStyle, fontSize, widthMm }) => {
    pdf.setFont(fontFamily, fontStyle);
    pdf.setFontSize(fontSize);
    return pdf.splitTextToSize(text, widthMm) as string[];
  },
});

export const evaluateContentEnvelope = <TSource extends object>(
  templateId: string,
  envelope: ContentEnvelope,
  source: TSource,
  measurement: MeasurementContext,
  consumedContentIds: readonly string[] = [],
): TemplateCompatibilityResult<TSource> => {
  const issues: ContractIssue[] = [];
  const preparedSlots: Record<string, PreparedTemplateSlot> = {};

  for (const slot of envelope.slots) {
    const value = getValueAtPath(source, slot.path);

    if (isMissing(slot, value)) {
      if (slot.required) {
        issues.push(issue(slot, "required_slot_missing", "Required slot content is missing."));
      }
      continue;
    }

    const result = slot.kind === "text"
      ? prepareTextSlot(slot, value, measurement)
      : slot.kind === "collection"
      ? prepareCollectionSlot(slot, value)
      : prepareImageSlot(slot, value);

    issues.push(...result.issues);
    if (result.prepared) preparedSlots[slot.id] = result.prepared;
  }

  return issues.length > 0
    ? { compatible: false, instance: null, issues }
    : {
        compatible: true,
        instance: { templateId, source, preparedSlots, consumedContentIds },
        issues: [],
      };
};
