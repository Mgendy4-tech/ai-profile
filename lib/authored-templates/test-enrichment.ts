import { adaptProductionContentToEditorialInteriorsV1 } from "./adapter";
import {
  EDITORIAL_INTERIORS_V1_FIELD_CLASSIFICATION,
  enrichProductionContentForAuthoredTemplates,
  type ProductionEnrichmentInput,
} from "./enrichment";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const PNG = "data:image/png;base64,production-png-payload";
const JPEG = "data:image/jpeg;base64,production-jpeg-payload";

const input = (): ProductionEnrichmentInput => ({
  company: {
    name: "Aurelia Interior Studio",
    logoUrl: "data:image/png;base64,logo",
    about: " About source bytes remain exact. ",
    activities: "Activities source bytes remain exact.",
    experience: "Experience source bytes remain exact.",
  },
  profile: {
    companyName: "Aurelia Interior Studio",
    companyType: "Fictional PoC",
    sections: [{
      id: "about",
      title: "About",
      description: "Source description.",
      content: " About source bytes remain exact. ",
      items: [{ name: "First item", description: "First exact item description." }],
    }],
  },
  projects: [
    { id: "project-1", name: "Project One", category: "PoC", description: "Exact project one description.", imageUrl: PNG },
    { id: "project-2", name: "Project Two", description: "Exact project two description.", imageUrl: JPEG },
  ],
  contextualVisuals: [{
    role: "contextual_stock",
    provenance: "pexels",
    briefId: "context",
    purpose: "contextual",
    placement: "column",
    aspectRatio: "4:3",
    status: "selected",
    source: "pexels",
    photographer: "Test",
    imageUrl: "https://example.test/context.jpg",
    width: 1200,
    height: 900,
    overallScore: 1,
    fallbackReason: null,
  }],
});

const run = async () => {
const source = input();
const sourceBefore = JSON.stringify(source);
const decodedSources: string[] = [];
const result = await enrichProductionContentForAuthoredTemplates(source, async (imageSource) => {
  decodedSources.push(imageSource);
  return imageSource === PNG ? { width: 1200, height: 1600 } : { width: 1800, height: 1200 };
});

assert(JSON.stringify(source) === sourceBefore, "Enrichment must not mutate or freeze caller-owned values.");
assert(!Object.isFrozen(source) && !Object.isFrozen(source.projects), "Caller-owned source objects must remain untouched.");
assert(Object.isFrozen(result) && Object.isFrozen(result.adapterInput.projectVisuals), "The enrichment result must be immutable.");
assert(result.adapterInput.company.name === source.company.name, "Direct company fields must remain exact.");
assert(result.adapterInput.company.about === " About source bytes remain exact. ", "Source strings must remain byte-for-byte unchanged.");
assert(result.adapterInput.sections[0].id === "about", "Existing section IDs must be preserved.");
assert(result.adapterInput.sections[0].items[0].id === "about:item:0", "Missing generated-item IDs must be derived deterministically from source identity and position.");
assert(result.adapterInput.projects[0].id === "project-1", "Project associations and IDs must be preserved.");
assert(decodedSources.join("|") === `${PNG}|${JPEG}`, "Every supported authentic project image must be decoded exactly once in source order.");

const png = result.adapterInput.projectVisuals[0];
const jpeg = result.adapterInput.projectVisuals[1];
assert(png.format === "PNG" && png.width === 1200 && png.height === 1600 && png.aspectRatio === 0.75, "PNG metadata must be explicit and exactly derived.");
assert(jpeg.format === "JPEG" && jpeg.width === 1800 && jpeg.height === 1200 && jpeg.aspectRatio === 1.5, "JPEG metadata must be explicit and exactly derived.");
assert(png.role === "project_image" && png.provenance === "user_upload" && png.projectId === "project-1", "Authentic role, provenance, and project association must survive enrichment.");
assert(result.adapterInput.contextualVisuals?.[0].role === "contextual_stock" && result.adapterInput.projectVisuals.length === 2, "Contextual imagery must remain separate and must never be promoted.");
assert(result.roleReadiness.filter((role) => role.status === "candidate_available").map((role) => role.pageRole).join("|") === "cover|narrative|project_feature", "Current truthful company, narrative, project, and authentic-image data must construct the three supported roles.");
assert(result.roleReadiness.find((role) => role.pageRole === "capabilities")?.status === "upstream_enrichment_required", "A missing four-item capability section must remain independently unavailable.");
assert(Object.values(EDITORIAL_INTERIORS_V1_FIELD_CLASSIFICATION).includes("UNSAFE_POC_ONLY"), "The production field classification must explicitly identify unsafe PoC-only data.");

const unknown = input();
unknown.projects[0].imageUrl = "data:image/webp;base64,unsupported";
unknown.projects[1].imageUrl = "https://example.test/arbitrary.jpg";
const unknownResult = await enrichProductionContentForAuthoredTemplates(unknown, async () => ({ width: 1, height: 1 }));
assert(unknownResult.adapterInput.projectVisuals.length === 0, "Unknown formats must not produce project visuals.");
assert(unknownResult.diagnostics.filter((issue) => issue.code === "image_format_unknown").length === 2, "Unknown formats must fail explicitly without decoder calls or guesses.");

const invalidDimensions = input();
invalidDimensions.projects = [invalidDimensions.projects[0]];
const invalidResult = await enrichProductionContentForAuthoredTemplates(invalidDimensions, async () => ({ width: 0, height: 100 }));
assert(invalidResult.diagnostics.some((issue) => issue.code === "image_dimensions_invalid"), "Invalid decoded dimensions must be rejected.");

const decodeFailure = input();
decodeFailure.projects = [decodeFailure.projects[0]];
const failedResult = await enrichProductionContentForAuthoredTemplates(decodeFailure, async () => { throw new Error("Deterministic decode failure"); });
assert(failedResult.diagnostics.some((issue) => issue.code === "image_decode_failed" && issue.path === "projects.0.imageUrl"), "Decode failures must have stable codes and exact paths.");
assert(JSON.stringify(failedResult) === JSON.stringify(await enrichProductionContentForAuthoredTemplates(decodeFailure, async () => { throw new Error("Deterministic decode failure"); })), "Enrichment diagnostics must be deterministic.");

const partial = input();
partial.projects = [partial.projects[0]];
partial.upstreamAuthoredPages = {
  narrative: {
    contentId: "about",
    title: "Existing upstream authored headline.",
    body: " About source bytes remain exact. ",
    callout: { text: "Existing upstream semantic callout.", label: "EXPLICIT UPSTREAM POC LABEL" },
    secondaryBlock: { title: "Explicit upstream source", body: "Existing explicitly supplied second narrative block." },
  },
};
const partialResult = await enrichProductionContentForAuthoredTemplates(partial, async () => ({ width: 1200, height: 1600 }));
assert(partialResult.roleReadiness.find((role) => role.pageRole === "narrative")?.status === "candidate_available", "Explicit upstream semantic content must enable only its page role.");
assert(partialResult.roleReadiness.filter((role) => role.status === "upstream_enrichment_required").length === 1, "Partial readiness must remain role-specific.");
const adaptedPartial = adaptProductionContentToEditorialInteriorsV1(partialResult.adapterInput);
assert(adaptedPartial.pages.narrative.status === "ready" && adaptedPartial.pages.cover.status === "ready", "The Phase C adapter must preserve truthful derived coverage after enrichment.");
assert(!("info" in partialResult.adapterInput.authoredPages.narrative!), "Enrichment must not invent project metadata, KPIs, scope, deliverables, or other semantic values.");

console.log("Phase C.5 production enrichment tests passed.");
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
