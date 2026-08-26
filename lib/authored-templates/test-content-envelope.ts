import { jsPDF } from "jspdf";
import {
  createJsPDFMeasurementContext,
  evaluateContentEnvelope,
} from "./content-envelope";
import type {
  ContentEnvelope,
  ImageSlotValue,
  TextSlotEnvelope,
} from "./types";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const pdf = new jsPDF({ unit: "mm", format: "a4" });
const measurement = createJsPDFMeasurementContext(pdf);

const coverTitle: TextSlotEnvelope = {
  id: "companyName",
  path: "company.name",
  kind: "text",
  required: true,
  fontFamily: "times",
  fontStyle: "normal",
  fontSize: 52,
  widthMm: 59,
  maxLines: 3,
};

const titleEnvelope: ContentEnvelope = { slots: [coverTitle] };
for (const name of [
  "Aurelia Interior Studio",
  "Luma PoC Studio",
  "Ili & Ili Studios Limited",
]) {
  const result = evaluateContentEnvelope(
    "cover-test",
    titleEnvelope,
    { company: { name } },
    measurement,
  );
  assert(result.compatible, `${name} must fit the fixed cover title contract.`);
}

const exactTwoLineText = "alpha beta gamma delta";
const controlledMeasurement = {
  wrapText: ({ text }: { text: string }) =>
    text === exactTwoLineText ? ["alpha beta", "gamma delta"] : ["one", "two", "three"],
};
const twoLineSlot: TextSlotEnvelope = {
    id: "body",
    path: "body",
    kind: "text",
    required: true,
    fontFamily: "helvetica",
    fontStyle: "normal",
    fontSize: 10,
    widthMm: 80,
    maxLines: 2,
};
const twoLineEnvelope: ContentEnvelope = { slots: [twoLineSlot] };
assert(
  evaluateContentEnvelope("two-lines", twoLineEnvelope, { body: exactTwoLineText }, controlledMeasurement).compatible,
  "Text at the exact maximum line count must pass.",
);
const lineOverflow = evaluateContentEnvelope(
  "two-lines",
  twoLineEnvelope,
  { body: "one line beyond" },
  controlledMeasurement,
);
assert(!lineOverflow.compatible, "Text one line over capacity must fail.");
if (!lineOverflow.compatible) {
  assert(lineOverflow.issues[0].code === "text_line_limit_exceeded", "Text overflow issue code must be stable.");
  assert(lineOverflow.issues[0].path === "body", "Text overflow path must identify the exact slot.");
}

const collectionEnvelope: ContentEnvelope = {
  slots: [{
    id: "capabilityItems",
    path: "capability.items",
    kind: "collection",
    required: true,
    minItems: 2,
    maxItems: 3,
  }],
};
assert(
  evaluateContentEnvelope("collection", collectionEnvelope, { capability: { items: ["a", "b", "c"] } }, measurement).compatible,
  "Collection at maximum capacity must pass.",
);
const collectionOverflow = evaluateContentEnvelope(
  "collection",
  collectionEnvelope,
  { capability: { items: ["a", "b", "c", "d"] } },
  measurement,
);
assert(!collectionOverflow.compatible, "Excess collection items must fail.");
if (!collectionOverflow.compatible) {
  assert(collectionOverflow.issues[0].code === "collection_above_maximum", "Collection issue code must be stable.");
  assert(collectionOverflow.issues[0].path === "capability.items", "Collection issue path must identify the exact slot.");
}

const contextualEnvelope: ContentEnvelope = {
  slots: [{
    id: "hero",
    path: "visuals.hero",
    kind: "image",
    required: true,
    allowedRoles: ["contextual_stock"],
    allowedProvenances: ["pexels"],
    minimumAspectRatio: 1.2,
    maximumAspectRatio: 2,
  }],
};
const contextualImage: ImageSlotValue = {
  role: "contextual_stock",
  provenance: "pexels",
  format: "JPEG",
  width: 1600,
  height: 1000,
  source: "https://images.example.test/context.jpg",
};
assert(
  evaluateContentEnvelope("contextual", contextualEnvelope, { visuals: { hero: contextualImage } }, measurement).compatible,
  "Valid contextual image must pass role, provenance, and aspect validation.",
);

const missingImage = evaluateContentEnvelope("contextual", contextualEnvelope, { visuals: {} }, measurement);
assert(!missingImage.compatible, "Missing required image must fail.");
if (!missingImage.compatible) {
  assert(missingImage.issues[0].code === "required_slot_missing", "Missing-image issue code must be stable.");
  assert(missingImage.issues[0].path === "visuals.hero", "Missing-image path must identify the exact slot.");
}

const wrongProvenance = evaluateContentEnvelope(
  "contextual",
  contextualEnvelope,
  { visuals: { hero: { ...contextualImage, provenance: "ai_generated_fictional_poc_test_asset" as const } } },
  measurement,
);
assert(!wrongProvenance.compatible, "Wrong image provenance must fail.");
if (!wrongProvenance.compatible) {
  assert(wrongProvenance.issues[0].code === "image_provenance_not_allowed", "Provenance issue code must be stable.");
}

const uploadedProject: ImageSlotValue = {
  role: "project_image",
  provenance: "user_upload",
  format: "PNG",
  width: 1200,
  height: 800,
  source: "data:image/png;base64,test",
};
const projectInContextual = evaluateContentEnvelope(
  "contextual",
  contextualEnvelope,
  { visuals: { hero: uploadedProject } },
  measurement,
);
assert(!projectInContextual.compatible, "Project image must be rejected from contextual slot.");
if (!projectInContextual.compatible) {
  assert(projectInContextual.issues.some((entry) => entry.code === "image_role_not_allowed"), "Contextual slot must report project-role rejection.");
}

const projectEnvelope: ContentEnvelope = {
  slots: [{
    id: "projectHero",
    path: "project.image",
    kind: "image",
    required: true,
    allowedRoles: ["project_image"],
    allowedProvenances: ["user_upload"],
  }],
};
const contextualInProject = evaluateContentEnvelope(
  "project",
  projectEnvelope,
  { project: { image: contextualImage } },
  measurement,
);
assert(!contextualInProject.compatible, "Contextual stock must be rejected from project slot.");
if (!contextualInProject.compatible) {
  assert(contextualInProject.issues.some((entry) => entry.code === "image_role_not_allowed"), "Project slot must report contextual-role rejection.");
}

const original = "  Source copy stays byte-for-byte unchanged.  ";
const source = { body: original };
const preserved = evaluateContentEnvelope(
  "preserve-copy",
  { slots: [{ ...twoLineSlot, maxLines: 3 }] },
  source,
  controlledMeasurement,
);
assert(preserved.compatible, "Preservation fixture must pass.");
if (preserved.compatible) {
  assert(preserved.instance.source === source, "Compatibility must retain the original source object.");
  assert(preserved.instance.source.body === original, "Source string must remain byte-for-byte unchanged.");
  const prepared = preserved.instance.preparedSlots.body;
  assert(prepared.kind === "text" && prepared.source === original, "Prepared text must retain the exact source string.");
}

const multipleFailureEnvelope: ContentEnvelope = {
  slots: [
    { ...coverTitle, id: "missingTitle", path: "company.missing" },
    { ...collectionEnvelope.slots[0], id: "tooMany", path: "items" },
    { ...contextualEnvelope.slots[0], id: "wrongImage", path: "image" },
  ],
};
const multipleFailures = evaluateContentEnvelope(
  "multiple",
  multipleFailureEnvelope,
  { items: [1, 2, 3, 4], image: uploadedProject },
  measurement,
);
assert(!multipleFailures.compatible, "Independent failures must be reported together.");
if (!multipleFailures.compatible) {
  assert(
    multipleFailures.issues.map(({ code, path }) => `${code}:${path}`).join("|") ===
      "required_slot_missing:company.missing|collection_above_maximum:items|image_role_not_allowed:image|image_provenance_not_allowed:image",
    "Multiple failures must use stable codes, exact paths, and deterministic order.",
  );
}

console.log("Authored template content-envelope tests passed.");
