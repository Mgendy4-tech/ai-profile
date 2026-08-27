import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { routeEditorialInteriorsV1Export } from "./authored-templates/export-orchestrator";
import {
  PRODUCTION_V1_LIMITS,
  createProfileGenerationModelPayload,
  createStructureAnalysisModelPayload,
  validateAuthoredImageOperationalLimits,
  validateGenerationRequestSize,
} from "./production-limits";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => { if (!condition) throw new Error(message); };
const actualLogo = `data:image/png;base64,${readFileSync(resolve("lib/test-fixtures/logos/brand-square-transparent.png")).toString("base64")}`;
// JPEG decoders permit trailing bytes; this remains a decodable logo while reproducing a safely sub-3-MiB upload whose data URL exceeds 256 KiB.
const mobileLogo = `data:image/jpeg;base64,${Buffer.concat([readFileSync(resolve("lib/test-fixtures/logos/brand-wide.jpg")), Buffer.alloc(300 * 1024, 7)]).toString("base64")}`;
const projectImage = `data:image/jpeg;base64,${Buffer.alloc(300 * 1024, 11).toString("base64")}`;
const company = { name: "Northbridge Advisory", about: "Small advisory company profile.", activities: "Business consulting services.", experience: "", logoUrl: mobileLogo };
const project = { id: "project:one", name: "One Project", category: "residential", description: "A small project description.", imageUrl: projectImage };

const analysisPayload = createStructureAnalysisModelPayload({ company, projects: [], generatedProfile: { content: "x".repeat(400_000) }, profileStructure: { duplicated: true } });
assert(!validateGenerationRequestSize(analysisPayload), "A small logo-only analysis payload must remain below the text-model request limit.");
assert(!JSON.stringify(analysisPayload).includes("base64") && !("logoUrl" in analysisPayload.company), "Analysis model payload must exclude raw logo bytes and unrelated browser state.");

const selectedSections = [
  { id: "about", displayTitle: "About Northbridge", description: "Describe the supplied company." },
  { id: "services", displayTitle: "Advisory Services", description: "Present business consulting services.", semanticRole: "services" },
];
const generationPayload = createProfileGenerationModelPayload({ company, projects: [], selectedSections, generatedProfile: { content: "x".repeat(400_000) } });
assert(!validateGenerationRequestSize(generationPayload), "Small profile generation with a persisted logo must remain below the text-model request limit.");
assert(!JSON.stringify(generationPayload).includes("base64") && !("logoUrl" in generationPayload.company), "Generation model payload must exclude raw logo bytes and generated-profile state.");
assert(generationPayload.selectedSections.map((section) => section.id).join("|") === "about|services", "Approved section identity and order must survive request projection.");

const visualPayload = createProfileGenerationModelPayload({ company: { ...company, logoUrl: "" }, projects: [project], selectedSections });
assert(!validateGenerationRequestSize(visualPayload), "Project image bytes must not consume the text-generation budget.");
assert(!JSON.stringify(visualPayload).includes("base64") && !("imageUrl" in visualPayload.projects[0]), "Project image bytes must be excluded while semantic project metadata remains.");
assert(visualPayload.projects[0].name === project.name && visualPayload.projects[0].description === project.description, "Project semantic metadata must survive projection.");

const oversizedText = createProfileGenerationModelPayload({ company: { name: "Large", about: "x".repeat(PRODUCTION_V1_LIMITS.generationRequestBytes), activities: "", experience: "" }, projects: [], selectedSections });
assert(validateGenerationRequestSize(oversizedText)?.code === "generation_request_limit", "Genuinely oversized textual input must fail deterministically.");
assert(validateAuthoredImageOperationalLimits({ logoUrl: mobileLogo }, []).length === 0, "A valid-size persisted logo must remain independently accepted.");
const oversizedImage = `data:image/png;base64,${Buffer.alloc(PRODUCTION_V1_LIMITS.imageBytes + 1).toString("base64")}`;
assert(validateAuthoredImageOperationalLimits({ logoUrl: oversizedImage }, []).some((issue) => issue.code === "image_byte_limit"), "The independent per-image limit must remain enforced.");
assert(validateAuthoredImageOperationalLimits({}, [{ imageUrl: oversizedImage }]).some((issue) => issue.code === "image_byte_limit"), "Project images must retain the independent per-image limit.");

const main = async () => {
  const profile = { companyName: company.name, companyType: "Business consulting services", sections: [
    { id: "about", title: "About Northbridge", description: selectedSections[0].description, content: "Northbridge Advisory is a small advisory company.", items: [] },
    { id: "services", title: "Advisory Services", description: selectedSections[1].description, content: "Northbridge provides business consulting services.", items: [
      { name: "Business Consulting", description: "Business consulting services for company needs." },
    ] },
  ] };
  const withLogo = await routeEditorialInteriorsV1Export({ company: { ...company, logoUrl: actualLogo }, profile, projects: [] }, async () => ({ width: 640, height: 640 }));
  const withoutLogo = await routeEditorialInteriorsV1Export({ company: { ...company, logoUrl: "" }, profile, projects: [] }, async () => ({ width: 640, height: 640 }));
  assert(withLogo.mode === "authored" && withLogo.familyId === "corporate-services", "Logo-only Corporate profile must reach authored export.");
  assert(withoutLogo.mode === "authored" && !Buffer.from(withLogo.pdf.output("arraybuffer")).equals(Buffer.from(withoutLogo.pdf.output("arraybuffer"))), "Persisted logo must remain available to and alter the authored cover export.");
  console.log("Text-model request accounting, independent image limits, and authored logo survival tests passed.");
};

main().catch((error) => { console.error(error); process.exitCode = 1; });
