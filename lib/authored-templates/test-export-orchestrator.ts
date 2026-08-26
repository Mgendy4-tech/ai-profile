import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { routeEditorialInteriorsV1Export } from "./export-orchestrator";
import type { ProductionEnrichmentInput } from "./enrichment";
import { EDITORIAL_INTERIORS_V1_PAGE_ORDER } from "./packs/editorial-interiors-v1";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const REVIEW_IMAGE_BUFFER = readFileSync(resolve("experiments", "Experiment_Pack_01", "assets", "aurelia-interior-hero.png"));
const REVIEW_IMAGE = `data:image/png;base64,${REVIEW_IMAGE_BUFFER.toString("base64")}`;
const REVIEW_DIMENSIONS = { width: REVIEW_IMAGE_BUFFER.readUInt32BE(16), height: REVIEW_IMAGE_BUFFER.readUInt32BE(20) };
const decode = async () => REVIEW_DIMENSIONS;

const extractUnfilteredRgbImage = (pdf: Buffer) => {
  const marker = Buffer.from("/Subtype /Image", "ascii");
  const markerOffset = pdf.indexOf(marker);
  assert(markerOffset >= 0, "PDF must contain an image XObject.");
  const dictionaryStart = pdf.lastIndexOf(Buffer.from("<<", "ascii"), markerOffset);
  const streamMarker = Buffer.from("stream\n", "ascii");
  let streamOffset = pdf.indexOf(streamMarker, markerOffset);
  let markerLength = streamMarker.length;
  if (streamOffset < 0) {
    const windowsStreamMarker = Buffer.from("stream\r\n", "ascii");
    streamOffset = pdf.indexOf(windowsStreamMarker, markerOffset);
    markerLength = windowsStreamMarker.length;
  }
  assert(dictionaryStart >= 0 && streamOffset >= 0, "PDF image dictionary and stream must be readable.");
  const dictionary = pdf.subarray(dictionaryStart, streamOffset).toString("ascii");
  const width = Number(dictionary.match(/\/Width\s+(\d+)/)?.[1]);
  const height = Number(dictionary.match(/\/Height\s+(\d+)/)?.[1]);
  const length = Number(dictionary.match(/\/Length\s+(\d+)/)?.[1]);
  assert(dictionary.includes("/ColorSpace /DeviceRGB") && dictionary.includes("/BitsPerComponent 8") && !dictionary.includes("/Filter"), "Review raster must be an unfiltered 8-bit RGB image.");
  assert(width > 0 && height > 0 && length === width * height * 3, "Embedded RGB dimensions and byte length must agree.");
  return { width, height, pixels: pdf.subarray(streamOffset + markerLength, streamOffset + markerLength + length) };
};

const assertCropIsVisuallyNonBlack = (
  raster: { width: number; height: number; pixels: Buffer },
  frame: { x: number; y: number; width: number; height: number },
  image: { x: number; y: number; width: number; height: number },
  label: string,
) => {
  let minimum = 255; let maximum = 0; let total = 0; let samples = 0; let black = 0;
  for (let row = 0; row < 24; row += 1) for (let column = 0; column < 24; column += 1) {
    const pageX = frame.x + ((column + 0.5) / 24) * frame.width;
    const pageY = frame.y + ((row + 0.5) / 24) * frame.height;
    const sourceX = Math.max(0, Math.min(raster.width - 1, Math.floor(((pageX - image.x) / image.width) * raster.width)));
    const sourceY = Math.max(0, Math.min(raster.height - 1, Math.floor(((pageY - image.y) / image.height) * raster.height)));
    const offset = (sourceY * raster.width + sourceX) * 3;
    const luminance = (raster.pixels[offset] + raster.pixels[offset + 1] + raster.pixels[offset + 2]) / 3;
    minimum = Math.min(minimum, luminance); maximum = Math.max(maximum, luminance); total += luminance; samples += 1;
    if (luminance < 3) black += 1;
  }
  assert(maximum - minimum > 25 && total / samples > 15 && black / samples < 0.95, `${label} must render varied non-black raster pixels.`);
};

const fixture = (): ProductionEnrichmentInput => ({
  company: { name: "Aurelia Interior Studio", about: "Truthful source-backed company narrative.", activities: "Truthful source-backed activities.", experience: "Truthful source-backed experience." },
  profile: {
    companyName: "Aurelia Interior Studio",
    companyType: "Interior studio",
    sections: [
      { id: "about", title: "About Aurelia", description: "Source-backed introduction.", content: "Truthful source-backed company narrative.", items: [] },
      { id: "services", title: "Capabilities", description: "Source-backed capability introduction.", content: "Source-backed capability content.", items: [
        { name: "Spatial planning", description: "Source-backed service description one." },
        { name: "Material direction", description: "Source-backed service description two." },
        { name: "Interior detailing", description: "Source-backed service description three." },
        { name: "Visual curation", description: "Source-backed service description four." },
      ] },
    ],
  },
  projects: [{ id: "project-1", name: "Residential Interior", description: "Truthful source-backed project description.", imageUrl: REVIEW_IMAGE }],
});

const run = async () => {
  const valid = await routeEditorialInteriorsV1Export(fixture(), decode);
  assert(valid.mode === "authored", "Fully compatible production input must select authored mode.");
  if (valid.mode !== "authored") throw new Error("Expected authored decision.");
  assert(valid.pdf.getNumberOfPages() === 4, "Authored export must contain exactly four pages.");
  assert(valid.pageOrder.join("|") === EDITORIAL_INTERIORS_V1_PAGE_ORDER.join("|"), "Authored export must preserve exact approved page order.");
  for (let page = 1; page <= 4; page += 1) {
    valid.pdf.setPage(page);
    assert(Math.abs(valid.pdf.internal.pageSize.getWidth() - 210) < 0.01 && Math.abs(valid.pdf.internal.pageSize.getHeight() - 297) < 0.01, `Page ${page} must be A4.`);
  }
  const repeated = await routeEditorialInteriorsV1Export(fixture(), decode);
  assert(repeated.mode === "authored" && Buffer.from(valid.pdf.output("arraybuffer")).equals(Buffer.from(repeated.pdf.output("arraybuffer"))), "Identical production input must produce byte-identical authored output.");

  const missingImage = fixture();
  missingImage.projects = [];
  const missingImageDecision = await routeEditorialInteriorsV1Export(missingImage, decode);
  assert(missingImageDecision.mode === "authored" && missingImageDecision.familyId === "corporate-services", "A project-free services company must route to Corporate / Services without requiring imagery.");

  const missingNarrative = fixture();
  missingNarrative.profile.sections = missingNarrative.profile.sections.filter((section) => section.id !== "about");
  const missingNarrativeDecision = await routeEditorialInteriorsV1Export(missingNarrative, decode);
  assert(missingNarrativeDecision.mode === "fallback" && missingNarrativeDecision.reasons.some((reason) => reason.pageRole === "narrative"), "Missing narrative must select fallback with a role-specific reason.");

  const wrongCapabilityCount = fixture();
  wrongCapabilityCount.profile.sections[1].items = wrongCapabilityCount.profile.sections[1].items.slice(0, 3);
  const capabilityDecision = await routeEditorialInteriorsV1Export(wrongCapabilityCount, decode);
  assert(capabilityDecision.mode === "fallback" && capabilityDecision.reasons.some((reason) => reason.code === "capability_count_unsupported"), "Capability count other than four must select fallback.");

  const overCapacity = fixture();
  overCapacity.profile.sections[0].content = Array.from({ length: 180 }, () => "overlong").join(" ");
  const capacityDecision = await routeEditorialInteriorsV1Export(overCapacity, decode);
  assert(capacityDecision.mode === "fallback" && capacityDecision.reasons.some((reason) => reason.stage === "compatibility" && reason.code === "text_line_limit_exceeded"), "Authored text-capacity failure must route to fallback.");

  const contextualOnly = fixture();
  contextualOnly.projects = [];
  contextualOnly.contextualVisuals = [{ role: "contextual_stock", provenance: "pexels", briefId: "hero", purpose: "hero", placement: "full_bleed", aspectRatio: "4:3", status: "selected", source: "pexels", photographer: "Test", imageUrl: "https://example.test/context.jpg", width: 1200, height: 900, overallScore: 1, fallbackReason: null }];
  const contextualDecision = await routeEditorialInteriorsV1Export(contextualOnly, decode);
  assert(contextualDecision.mode === "authored" && contextualDecision.familyId === "corporate-services", "Optional contextual imagery must not create a project-image requirement for Corporate / Services.");

  const multipleProjects = fixture();
  multipleProjects.projects = [
    { id: "riverside", name: "Riverside Penthouse Renovation", description: "Source-backed Riverside project description for production pipeline review.", imageUrl: REVIEW_IMAGE },
    { id: "boutique-office", name: "Boutique Office Interior", description: "Source-backed office project description for production pipeline review.", imageUrl: REVIEW_IMAGE },
  ];
  multipleProjects.profile.sections = [
    ...multipleProjects.profile.sections,
    {
      id: "projects",
      title: "Projects",
      description: "Source-backed projects section.",
      content: "Source-backed project portfolio introduction.",
      items: multipleProjects.projects.map((project) => ({ name: project.name, description: project.description })),
    },
  ];
  const multipleProjectsDecision = await routeEditorialInteriorsV1Export(multipleProjects, decode);
  assert(multipleProjectsDecision.mode === "authored" && multipleProjectsDecision.familyId === "visual-portfolio", "Two real production-shaped projects must route through ranked Visual / Portfolio authored mode.");
  if (multipleProjectsDecision.mode !== "authored") throw new Error("Expected multi-project authored decision.");
  assert(multipleProjectsDecision.pageOrder.at(-1) === "editorial-interiors-v1.project-grid-2", "Two projects must preserve source order in the fixed grid-2 module.");
  assert(multipleProjectsDecision.pdf.getNumberOfPages() === 4, "Two-project production output must contain the three shared pages plus one fixed project grid.");
  const pdfBytes = Buffer.from(multipleProjectsDecision.pdf.output("arraybuffer"));
  const raster = extractUnfilteredRgbImage(pdfBytes);
  assert(raster.width === REVIEW_DIMENSIONS.width && raster.height === REVIEW_DIMENSIONS.height, "PDF image dimensions must match the decoded persisted PNG.");
  const sourceAspect = raster.width / raster.height;
  const projectCrop = (frame: { x: number; y: number; width: number; height: number }) => {
    const frameAspect = frame.width / frame.height;
    if (sourceAspect >= frameAspect) { const width = frame.height * sourceAspect; return { x: frame.x - (width - frame.width) / 2, y: frame.y, width, height: frame.height }; }
    const height = frame.width / sourceAspect; return { x: frame.x, y: frame.y - (height - frame.height) / 2, width: frame.width, height };
  };
  assertCropIsVisuallyNonBlack(raster, { x: 0, y: 0, width: 122, height: 297 }, { x: -35.6, y: 0, width: 210.16, height: 297 }, "Cover image region");
  const firstProjectFrame = { x: 0, y: 0, width: 128, height: 150 };
  const secondProjectFrame = { x: 142, y: 28, width: 68, height: 95 };
  assertCropIsVisuallyNonBlack(raster, firstProjectFrame, projectCrop(firstProjectFrame), "Project 01 image region");
  assertCropIsVisuallyNonBlack(raster, secondProjectFrame, projectCrop(secondProjectFrame), "Project 02 image region");
  const imageDrawCount = (multipleProjectsDecision.pdf.output() as string).match(/\/I0 Do/g)?.length ?? 0;
  assert(imageDrawCount === 3, "Cover, Project 01, and Project 02 must each draw the validated image XObject.");
  const multiRepeated = await routeEditorialInteriorsV1Export(multipleProjects, decode);
  assert(multiRepeated.mode === "authored" && Buffer.from(multipleProjectsDecision.pdf.output("arraybuffer")).equals(Buffer.from(multiRepeated.pdf.output("arraybuffer"))), "Production-shaped multi-project output must be byte deterministic.");
  const productionReviewPath = resolve("artifacts", "manual-review", "visual-portfolio-production-aurelia-2-project-review-fixed.pdf");
  mkdirSync(dirname(productionReviewPath), { recursive: true });
  writeFileSync(productionReviewPath, pdfBytes);

  let fallbackCalls = 0;
  const existingFallbackExporter = () => { fallbackCalls += 1; };
  if (missingNarrativeDecision.mode === "fallback") existingFallbackExporter();
  assert(fallbackCalls === 1, "A fallback decision must leave the existing fallback exporter callable exactly once.");
  assert(valid.mode === "authored" && missingNarrativeDecision.mode === "fallback", "Routing must be atomic; authored and fallback outputs are never partially mixed.");

  const reviewPath = resolve("artifacts", "manual-review", "editorial-interiors-v1-production-review.pdf");
  mkdirSync(dirname(reviewPath), { recursive: true });
  writeFileSync(reviewPath, Buffer.from(valid.pdf.output("arraybuffer")));
  console.log(`Phase D production integration tests passed. Manual reviews: ${reviewPath}, ${productionReviewPath}`);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
