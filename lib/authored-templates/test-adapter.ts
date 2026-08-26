import type { CapabilitiesContent } from "./packs/editorial-interiors-v1/content";
import {
  adaptProductionContentToEditorialInteriorsV1,
  type ProductionAuthoredAdapterInput,
} from "./adapter";

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const TEST_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const capability = (index: string, title: string) => ({
  index,
  title,
  description: "Clearly labelled fictional PoC capability copy for deterministic adapter testing.",
  items: ["PoC planning", "PoC material study", "PoC visual review"],
});

const fixture = (): ProductionAuthoredAdapterInput => ({
  company: {
    id: "company:aurelia",
    name: "Aurelia Interior Studio",
    about: "Exact production about string — preserved.",
    activities: "Exact activities string.",
    experience: "Exact experience string.",
  },
  sections: [
    { id: "section:about", title: "About", description: "PoC description", content: "Exact production about string — preserved.", items: [] },
    {
      id: "section:capabilities",
      title: "Capabilities",
      description: "PoC capability description",
      content: "PoC capability content",
      items: [1, 2, 3, 4].map((number) => ({ id: `capability:${number}`, name: `Capability ${number}`, description: `Description ${number}` })),
    },
  ],
  projects: [{ id: "project:feature", name: "Interior Study / PoC Feature", description: "Exact project description." }],
  projectVisuals: [{ role: "project_image", provenance: "user_upload", projectId: "project:feature", imageUrl: TEST_PNG, format: "PNG", width: 1056, height: 1492, aspectRatio: 1056 / 1492 }],
  contextualVisuals: [],
  brandAnalysis: null,
  authoredPages: {
    cover: { contentId: "company:aurelia", documentLabel: "COMPANY PROFILE", companyName: "Aurelia Interior Studio", heroProjectId: "project:feature" },
    narrative: {
      contentId: "section:about",
      title: "Interiors shaped through light, material and rhythm.",
      body: "Exact production about string — preserved.",
      callout: { text: "A quiet framework for considered spaces.", label: "POC PLACEHOLDER / NOT A VERIFIED CLAIM" },
      secondaryBlock: { title: "A composition-led point of view", body: "PoC placeholder copy used only for authored compatibility testing." },
    },
    capabilities: {
      contentId: "section:capabilities",
      eyebrow: "02 / CAPABILITIES",
      heading: "A framework for considered interiors.",
      supportingLine: "Clearly labelled fictional PoC capability content.",
      capabilities: [capability("01", "Spatial Concept"), capability("02", "Material Direction"), capability("03", "Interior Detail"), capability("04", "Visual Curation")],
    },
    projectFeature: {
      contentId: "project:feature",
      title: "Interior Study / PoC Feature",
      heroProjectId: "project:feature",
      info: [
        { label: "IMAGE SOURCE", value: "USER UPLOAD" },
        { label: "CONTENT STATUS", value: "FICTIONAL POC" },
        { label: "INTENDED USE", value: "VISUAL TEST ONLY" },
      ],
      overviewBody: "Exact project description.",
      scope: { title: "PoC scope", items: ["Editorial image treatment", "Information hierarchy", "Case-study pacing"] },
    },
  },
});

const aurelia = fixture();
const before = JSON.stringify(aurelia);
const first = adaptProductionContentToEditorialInteriorsV1(aurelia);
assert(first.readyPageRoles.join("|") === "cover|narrative|capabilities|project_feature", "Aurelia PoC-shaped content must make all four roles ready.");
assert(JSON.stringify(aurelia) === before, "Adaptation must not mutate source objects.");
assert(first.pages.narrative.candidate?.body === "Exact production about string — preserved.", "Source strings must survive byte-for-byte.");
assert(first.pages.cover.candidate?.hero.provenance === "user_upload", "Project provenance must survive unchanged.");
assert(first.pages.cover.candidate?.hero.format === "PNG", "Image format must survive unchanged.");
assert(JSON.stringify(first) === JSON.stringify(adaptProductionContentToEditorialInteriorsV1(aurelia)), "Identical mapping and diagnostics must be deterministic.");
assert(!("consumedContentIds" in first), "The adapter must not consume content.");
assert(!("pdf" in first), "The adapter must not render.");

const sparse = fixture();
sparse.company.name = "Luma";
sparse.authoredPages.cover!.companyName = "Luma PoC Studio";
sparse.authoredPages.narrative!.body = "Short PoC copy.";
sparse.authoredPages.narrative!.secondaryBlock = undefined;
sparse.authoredPages.narrative!.callout = undefined;
sparse.authoredPages.capabilities!.capabilities.forEach((item) => { item.items = item.items.slice(0, 2); });
sparse.authoredPages.projectFeature!.overviewBody = "Short PoC project description.";
assert(adaptProductionContentToEditorialInteriorsV1(sparse).readyPageRoles.length === 4, "Sparse content must remain compatible.");

const dense = fixture();
dense.company.name = "Ili & Ili Studios Limited";
dense.authoredPages.cover!.companyName = "Ili & Ili Studios Limited";
dense.authoredPages.narrative!.body = "Dense PoC placeholder: this longer fictional narrative tests material, light, proportion, circulation, visual continuity and authored pacing without asserting real clients, commissions, achievements or built outcomes.";
dense.authoredPages.narrative!.secondaryBlock = { title: "Second block", body: "Dense PoC placeholder: a second longer passage tests fixed editorial capacity while preserving every source character and making no verified company claim." };
assert(adaptProductionContentToEditorialInteriorsV1(dense).readyPageRoles.length === 4, "Dense content at the supported envelope must remain compatible.");

const noImage = fixture();
noImage.projectVisuals = [];
const noImageResult = adaptProductionContentToEditorialInteriorsV1(noImage);
assert(noImageResult.pages.cover.status === "mapping_failure" && noImageResult.pages.projectFeature.status === "mapping_failure", "Missing authentic images must be mapping failures for image-dependent roles.");
assert(noImageResult.pages.narrative.status === "ready" && noImageResult.pages.capabilities.status === "ready", "Image mapping failures must not make independent roles globally incompatible.");
assert(noImageResult.mappingIssues.some((issue) => issue.code === "authentic_project_image_missing"), "Missing project imagery must use a stable diagnostic code.");

const contextualOnly = fixture();
contextualOnly.projectVisuals = [];
contextualOnly.contextualVisuals = [{ role: "contextual_stock", provenance: "pexels", briefId: "hero", purpose: "hero", placement: "full_bleed", aspectRatio: "4:3", status: "selected", source: "pexels", photographer: "PoC", imageUrl: "https://example.test/context.jpg", width: 1200, height: 900, overallScore: 1, fallbackReason: null }];
assert(adaptProductionContentToEditorialInteriorsV1(contextualOnly).pages.projectFeature.status === "mapping_failure", "Contextual stock must never be promoted into a project image.");

const tooMany = fixture();
(tooMany.authoredPages.capabilities!.capabilities as unknown as Array<CapabilitiesContent["capabilities"][number]>).push(capability("05", "Excess Capability"));
const tooManyResult = adaptProductionContentToEditorialInteriorsV1(tooMany);
assert(tooManyResult.pages.capabilities.status === "mapping_failure", "Excess capability groups must not be silently dropped.");
assert(tooManyResult.mappingIssues.some((issue) => issue.code === "capability_count_unsupported" && issue.path === "authoredPages.capabilities.capabilities"), "Excess capability diagnostics must be stable and exact.");

const overlong = fixture();
overlong.authoredPages.narrative!.body = Array.from({ length: 180 }, () => "overlong").join(" ");
const overlongResult = adaptProductionContentToEditorialInteriorsV1(overlong);
assert(overlongResult.pages.narrative.status === "compatibility_failure", "Overlong mapped narrative must be a compatibility failure, not a mapping failure.");
assert(overlongResult.pages.narrative.compatibilityIssues.some((issue) => issue.code === "text_line_limit_exceeded" && issue.path === "body"), "Compatibility diagnostics must identify the exact authored slot.");

const missingOptional = fixture();
delete missingOptional.contextualVisuals;
delete missingOptional.brandAnalysis;
assert(adaptProductionContentToEditorialInteriorsV1(missingOptional).readyPageRoles.length === 4, "Missing optional contextual/brand data must not block authored pages.");

const duplicate = fixture();
duplicate.projects[0].id = duplicate.sections[0].id;
const duplicateResult = adaptProductionContentToEditorialInteriorsV1(duplicate);
assert(duplicateResult.mappingIssues.some((issue) => issue.code === "duplicate_source_id" && issue.path === "projects.0.id"), "Duplicate source IDs must be diagnosed deterministically at the duplicate path.");

console.log("Phase C authored adapter tests passed.");
