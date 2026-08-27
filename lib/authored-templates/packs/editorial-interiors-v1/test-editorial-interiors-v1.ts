import { jsPDF } from "jspdf";
import { getAuthoredTemplatePack } from "../../registry";
import type { ImageSlotValue, PreparedTextSlot } from "../../types";
import type { EditorialInteriorsV1DocumentInput } from "./content";
import {
  EDITORIAL_INTERIORS_V1_PAGE_ORDER,
  editorialInteriorsV1Pack,
  editorialInteriorsSparseNarrativeTemplate,
  prepareEditorialInteriorsV1Document,
  renderPreparedEditorialInteriorsV1Document,
} from "./index";
import { editorialInteriorsV1VisualSystem as visual } from "./visual-system";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const TEST_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const syntheticProjectImage = (): ImageSlotValue => ({
  role: "project_image",
  provenance: "ai_generated_fictional_poc_test_asset",
  format: "PNG",
  width: 1056,
  height: 1492,
  source: TEST_PNG,
});

const createAureliaFixture = (): EditorialInteriorsV1DocumentInput => ({
  cover: {
    contentId: "cover:aurelia",
    documentLabel: "COMPANY PROFILE",
    companyName: "Aurelia Interior Studio",
    hero: syntheticProjectImage(),
  },
  narrative: {
    contentId: "section:about",
    title: "Interiors shaped through light, material and rhythm.",
    body: "PoC placeholder copy: Aurelia is presented here as a fictional interior studio exploring how spatial clarity, tactile materials and natural light can form a coherent visual language. This passage exists only to test authored editorial pacing.",
    callout: { text: "A quiet framework for considered spaces.", label: "POC EDITORIAL PLACEHOLDER / NOT A VERIFIED COMPANY CLAIM" },
    secondaryBlock: { title: "A composition-led point of view", body: "PoC placeholder copy: the proposed narrative balances atmosphere with practical structure, treating each room as part of a connected sequence rather than an isolated scene. No history, achievement or client outcome is asserted." },
  },
  capabilities: {
    contentId: "section:capabilities",
    eyebrow: "02 / CAPABILITIES",
    heading: "A framework for considered interiors.",
    supportingLine: "PoC capability placeholders for testing hierarchy and density; not verified Aurelia services.",
    capabilities: [
      { index: "01", title: "Spatial Concept", description: "PoC placeholder for early-stage spatial thinking and a coherent interior direction.", items: ["Planning studies", "Mood and atmosphere", "Design narrative"] },
      { index: "02", title: "Material Direction", description: "PoC placeholder for a restrained palette shaped around texture, tone and durability.", items: ["Material palette", "Finish studies", "Color direction"] },
      { index: "03", title: "Interior Detailing", description: "PoC placeholder for testing how crafted junctions and built elements read editorially.", items: ["Joinery studies", "Lighting intent", "Detail language"] },
      { index: "04", title: "Visual Curation", description: "PoC placeholder for composing furnishings and objects into a consistent spatial mood.", items: ["Furniture direction", "Object placement", "Styling studies"] },
    ],
  },
  projectFeature: {
    contentId: "project:feature",
    title: "Interior Study / PoC Feature",
    hero: syntheticProjectImage(),
    info: [
      { label: "IMAGE SOURCE", value: "AI-GENERATED" },
      { label: "PROJECT STATUS", value: "FICTIONAL POC" },
      { label: "INTENDED USE", value: "VISUAL TEST ONLY" },
    ],
    overviewBody: "PoC placeholder copy: this fictional interior study tests how a single visual can anchor a restrained case-study page. It does not represent a built Aurelia project, client commission or verified design outcome.",
    scope: { title: "Test scope", items: ["Editorial image treatment", "Information hierarchy", "Case-study pacing"] },
  },
});

const createSparseFixture = (): EditorialInteriorsV1DocumentInput => {
  const fixture = createAureliaFixture();
  fixture.cover.contentId = "cover:sparse";
  fixture.cover.companyName = "Luma PoC Studio";
  fixture.narrative.contentId = "section:sparse-about";
  fixture.narrative.title = "Quiet spaces, simply considered.";
  fixture.narrative.body = "Sparse PoC placeholder: a short fictional studio note.";
  fixture.narrative.secondaryBlock = undefined;
  fixture.narrative.callout = undefined;
  fixture.capabilities.contentId = "section:sparse-capabilities";
  fixture.capabilities.capabilities.forEach((capability) => {
    capability.description = "Sparse fictional PoC capability placeholder.";
    capability.items = capability.items.slice(0, 2);
  });
  fixture.projectFeature.contentId = "project:sparse-feature";
  fixture.projectFeature.title = "Compact Interior Study / PoC";
  fixture.projectFeature.overviewBody = "Sparse PoC placeholder: a short fictional feature description.";
  return fixture;
};

const createDenseFixture = (): EditorialInteriorsV1DocumentInput => {
  const fixture = createAureliaFixture();
  fixture.cover.contentId = "cover:dense";
  fixture.cover.companyName = "Ili & Ili Studios Limited";
  fixture.narrative.contentId = "section:dense-about";
  fixture.narrative.title = "Layered interiors shaped by material, light and proportion.";
  fixture.narrative.body = "Dense PoC placeholder: Ili & Ili Studios Limited is a fictional practice created only to test the maximum supported narrative rhythm. The copy explores spatial sequence, natural light, tactile surfaces, tonal restraint and visual continuity without asserting real experience, commissions, clients or outcomes.";
  fixture.narrative.secondaryBlock = { title: "Extended source block", body: "Dense PoC placeholder: this second block deliberately approaches the fixed text capacity with a longer discussion of atmosphere, circulation, crafted junctions, furniture placement and material transitions. It remains test copy and does not describe completed work, verified expertise or an operating company history." };
  fixture.capabilities.contentId = "section:dense-capabilities";
  fixture.capabilities.heading = "Layered frameworks for interiors.";
  fixture.capabilities.capabilities.forEach((capability) => {
    capability.description = "Dense PoC placeholder covering circulation, proportion, zoning and connected spatial sequences across an extended fictional layout-capacity brief.";
  });
  fixture.projectFeature.contentId = "project:dense-feature";
  fixture.projectFeature.title = "Extended Interior Study / Fictional PoC";
  fixture.projectFeature.overviewBody = "Dense PoC placeholder: this fictional feature description approaches the authored slot limit while discussing spatial sequence, natural light, layered stone surfaces, warm timber tones, integrated shelving and restrained furniture placement. It is strictly visual test copy and does not represent a built project, client engagement or verified studio outcome.";
  return fixture;
};

for (const [name, fixture] of [
  ["Aurelia", createAureliaFixture()],
  ["sparse", createSparseFixture()],
  ["dense", createDenseFixture()],
] as const) {
  const result = prepareEditorialInteriorsV1Document(fixture);
  assert(result.compatible, `${name} fixture must satisfy the production pack.`);
}

assert(
  editorialInteriorsV1Pack.templates.slice(0, 4).map((template) => template.id).join("|") ===
    EDITORIAL_INTERIORS_V1_PAGE_ORDER.join("|"),
  "The pack's approved one-project template order must remain the first four templates.",
);
assert(getAuthoredTemplatePack("editorial-interiors-v1") === editorialInteriorsV1Pack, "Registry must return the single registered pack.");

const aureliaPrepared = prepareEditorialInteriorsV1Document(createAureliaFixture());
assert(aureliaPrepared.compatible, "Aurelia must prepare for document tests.");
if (!aureliaPrepared.compatible) throw new Error("Expected prepared Aurelia document.");
assert(
  new Set(aureliaPrepared.document.consumedContentIds).size === 4 &&
    aureliaPrepared.document.consumedContentIds.length === 4,
  "Every page content ID must be consumed exactly once.",
);

const sparsePrepared = prepareEditorialInteriorsV1Document(createSparseFixture());
assert(sparsePrepared.compatible, "Explicit sparse narrative fixture must prepare.");
if (!sparsePrepared.compatible) throw new Error("Expected sparse narrative preparation.");
assert(sparsePrepared.document.instances[1].templateId === editorialInteriorsSparseNarrativeTemplate.id, "Sparse narrative content must select the explicit sparse authored state.");
assert(!("callout" in sparsePrepared.document.instances[1].preparedSlots) && !("secondaryBody" in sparsePrepared.document.instances[1].preparedSlots), "Sparse narrative preflight must contain only its authored title/body slots.");
const sparseRender = renderPreparedEditorialInteriorsV1Document(sparsePrepared.document);
assert(sparseRender.audits[1].templateId === editorialInteriorsSparseNarrativeTemplate.id, "Sparse narrative renderer must preserve the selected template identity.");

const duplicateFixture = createAureliaFixture();
duplicateFixture.narrative.contentId = duplicateFixture.cover.contentId;
const duplicate = prepareEditorialInteriorsV1Document(duplicateFixture);
assert(!duplicate.compatible, "Duplicate content consumption must fail.");
if (!duplicate.compatible) {
  assert(duplicate.issues[0].code === "duplicate_content_consumption", "Duplicate consumption must use a stable issue code.");
  assert(duplicate.issues[0].path === "pages.1.contentId", "Duplicate consumption must identify the exact page path.");
}

const overCapacity = createDenseFixture();
overCapacity.capabilities.capabilities[0].items = ["one", "two", "three", "four"];
const capacityResult = prepareEditorialInteriorsV1Document(overCapacity);
assert(!capacityResult.compatible, "Over-capacity capability content must fail.");
if (!capacityResult.compatible) {
  assert(capacityResult.issues.some((entry) => entry.code === "collection_above_maximum"), "Over-capacity failure must identify collection maximum.");
}

const longTitle = createDenseFixture();
  longTitle.cover.companyName = "Architectural Studios Limited With An Excessively Long Unbrokenwordthatcannotfit";
const longTitleResult = prepareEditorialInteriorsV1Document(longTitle);
assert(!longTitleResult.compatible, "Overlong fixed-size cover line must fail.");
if (!longTitleResult.compatible) {
  assert(longTitleResult.issues.some((entry) => entry.path === "companyName"), "Cover rejection must identify the exact source-name slot.");
}

const wrongProjectProvenance = createAureliaFixture();
wrongProjectProvenance.projectFeature.hero = {
  ...syntheticProjectImage(),
  provenance: "pexels",
};
const provenanceResult = prepareEditorialInteriorsV1Document(wrongProjectProvenance);
assert(!provenanceResult.compatible, "Pexels provenance must be rejected from project feature.");
if (!provenanceResult.compatible) {
  assert(provenanceResult.issues.some((entry) => entry.code === "image_provenance_not_allowed"), "Project provenance rejection must be explicit.");
}

const contextualProject = createAureliaFixture();
contextualProject.projectFeature.hero = {
  ...syntheticProjectImage(),
  role: "contextual_stock",
  provenance: "pexels",
};
const contextualResult = prepareEditorialInteriorsV1Document(contextualProject);
assert(!contextualResult.compatible, "Contextual stock must be rejected from project feature.");
if (!contextualResult.compatible) {
  assert(contextualResult.issues.some((entry) => entry.code === "image_role_not_allowed"), "Project role rejection must be explicit.");
}

const invalidAspect = createAureliaFixture();
invalidAspect.projectFeature.hero = { ...syntheticProjectImage(), width: 2000, height: 500 };
const aspectResult = prepareEditorialInteriorsV1Document(invalidAspect);
assert(!aspectResult.compatible, "Out-of-envelope image aspect must fail.");
if (!aspectResult.compatible) {
  assert(aspectResult.issues.some((entry) => entry.code === "image_aspect_ratio_above_maximum"), "Aspect failure must identify the upper bound.");
}
const preparedHero = aureliaPrepared.document.instances[3].preparedSlots.hero;
assert(
  preparedHero.kind === "image" && Math.abs(preparedHero.aspectRatio - 1056 / 1492) < 0.000001,
  "Prepared image must retain the validated source aspect ratio.",
);

const firstRender = renderPreparedEditorialInteriorsV1Document(aureliaPrepared.document);
const secondPreparation = prepareEditorialInteriorsV1Document(createAureliaFixture());
assert(secondPreparation.compatible, "Second deterministic fixture must prepare.");
if (!secondPreparation.compatible) throw new Error("Expected second prepared document.");
const secondRender = renderPreparedEditorialInteriorsV1Document(secondPreparation.document);
assert(firstRender.pdf.getNumberOfPages() === 4, "Pack render must contain exactly four A4 pages.");
assert(
  Buffer.from(firstRender.pdf.output("arraybuffer")).equals(Buffer.from(secondRender.pdf.output("arraybuffer"))),
  "Identical input must produce byte-identical deterministic PDF output.",
);

firstRender.audits.forEach((audit, pageIndex) => {
  const instance = aureliaPrepared.document.instances[pageIndex];
  Object.entries(audit.renderedTextBySlot).forEach(([slotId, renderedLines]) => {
    const prepared = instance.preparedSlots[slotId] as PreparedTextSlot;
    assert(prepared.kind === "text", `Audit slot ${slotId} must reference prepared text.`);
    assert(renderedLines === prepared.lines, `Renderer must use the exact prepared line array for ${slotId}.`);
  });
});

const noReflowInput = createAureliaFixture();
const noReflowPrepared = prepareEditorialInteriorsV1Document(noReflowInput);
assert(noReflowPrepared.compatible, "No-reflow fixture must prepare.");
if (!noReflowPrepared.compatible) throw new Error("Expected no-reflow prepared document.");
const originalLines = noReflowPrepared.document.instances[1].preparedSlots.body;
assert(originalLines.kind === "text", "Narrative body must be prepared text.");
if (originalLines.kind !== "text") throw new Error("Expected prepared narrative text.");
noReflowInput.narrative.body = "MUTATED AFTER PREFLIGHT";
const noReflowRender = renderPreparedEditorialInteriorsV1Document(noReflowPrepared.document);
assert(
  noReflowRender.audits[1].renderedTextBySlot.body === originalLines.lines,
  "Renderer must not read or reflow mutated source text after preflight.",
);

assert(
  JSON.stringify({ page: visual.page, palette: visual.palette, crops: visual.crops }) ===
    JSON.stringify({
      page: { width: 210, height: 297, unit: "mm" },
      palette: {
        paper: [242, 238, 229], charcoal: [25, 24, 22], secondary: [75, 71, 65],
        ochre: [156, 108, 71], hairline: [181, 174, 162],
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
    }),
  "Approved page, palette, and crop geometry must remain regression-stable.",
);

const standalonePdf = new jsPDF({ unit: "mm", format: "a4" });
const coverAudit = editorialInteriorsV1Pack.templates[0].render(
  standalonePdf,
  aureliaPrepared.document.instances[0],
);
assert(coverAudit.templateId === EDITORIAL_INTERIORS_V1_PAGE_ORDER[0], "Standalone template metadata must remain stable.");

console.log("editorial-interiors-v1 authored pack tests passed.");
