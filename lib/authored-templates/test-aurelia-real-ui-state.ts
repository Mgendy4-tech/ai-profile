import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mustBlockLegacyFallback } from "../authored-export-policy";
import { isolateNewCompanyState } from "../profile-state-isolation";
import { reconstructPersistedProjects, resolveProjectsForCompanySave } from "../persisted-projects";
import { routeEditorialInteriorsV1Export } from "./export-orchestrator";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => { if (!condition) throw new Error(message); };
const bytes = readFileSync(resolve("lib/test-fixtures/visual/aurelia-browser-upload.jpg"));
const imageUrl = `data:image/jpeg;base64,${bytes.toString("base64")}`;
const company = { name: "Aurelia Interiors", logoUrl: "", companyType: "Interior Design Studio", industry: "Interior Design / Luxury Residential Interiors", customerType: "Luxury residential clients", servicesProducts: "Interior design, residential design, custom furniture, layered lighting", about: "Aurelia Interiors creates refined residential interiors around warm natural materials and calm neutral palettes.", activities: "Interior design, residential design, custom furniture, layered lighting", experience: "8" };
const project = { id: "project:aurelia-real-ui-riverside", name: "Riverside Residence", category: "Residential Interior", description: "A contemporary residential interior designed around warm natural materials, layered lighting, custom furniture, and a calm neutral palette.", imageUrl };
const sections = (projects = [project]) => [
  { id: "about", title: "About Aurelia Interiors", description: "An introduction to the studio.", content: "Aurelia Interiors is an interior design studio with 8 years of experience creating refined luxury residential interiors.", items: [] },
  { id: "services", title: "Interior Design Services", description: "Interior design services for luxury residential clients.", content: company.activities, items: ["Interior Design", "Residential Design", "Custom Furniture", "Layered Lighting"].map((name) => ({ name, description: `${name} grounded in supplied information.` })) },
  { id: "expertise", title: "Residential Design Expertise", description: "Residential expertise.", content: "Residential expertise using warm natural materials and calm neutral palettes.", items: [] },
  { id: "approach", title: "Our Design Approach", description: "The supplied design approach.", content: "Warm natural materials, layered lighting, custom furniture, and a calm neutral palette guide the design approach.", items: [] },
  ...(projects.length ? [{ id: "projects", title: "Selected Projects", description: "Selected project work.", content: projects.map((entry) => entry.description).join(" "), items: projects.map((entry) => ({ name: entry.name, description: entry.description })) }] : []),
];
const input = (projects = [project]) => ({ company, profile: { companyName: company.name, companyType: company.companyType, sections: sections(projects) }, projects });
const decode = async () => ({ width: 1600, height: 1200 });

const main = async () => {
  // Mirrors Save Project -> Save Company -> JSON persistence -> Generate reconstruction.
  const persistedProject = structuredClone(project);
  const savedProjectJson = JSON.stringify([persistedProject]);
  const companySaveSnapshot = resolveProjectsForCompanySave(savedProjectJson, []);
  assert(companySaveSnapshot.projects[0].id === project.id, "Save Company must prefer the synchronous stored project over a stale empty React closure.");
  const saved = isolateNewCompanyState(company, company, companySaveSnapshot.projects, true, new Set());
  const reconstructed = JSON.parse(JSON.stringify(saved.projects)) as typeof persistedProject[];
  assert(reconstructed[0].id === project.id && reconstructed[0].imageUrl === imageUrl, "Same-company save/reload must preserve stable project and image identity.");
  // Exact real-browser divergence: a previous identity existed, the user typed
  // Aurelia, then explicitly saved Riverside before saving the new company.
  const previousCompany = { ...company, name: "Previous Company" };
  const oldBehaviorState = isolateNewCompanyState(previousCompany, company, companySaveSnapshot.projects, false, new Set(), false);
  assert(oldBehaviorState.projects.length === 0, "Inherited projects must still be cleared on an identity switch.");
  const realBrowserState = isolateNewCompanyState(previousCompany, company, companySaveSnapshot.projects, false, new Set(), true);
  assert(realBrowserState.projects.length === 1 && (realBrowserState.projects[0] as typeof project).id === project.id, "A project explicitly saved after the identity edit must belong to Aurelia and survive Save Company.");
  const realBrowserReconstruction = reconstructPersistedProjects(JSON.stringify(realBrowserState.projects));
  assert(realBrowserReconstruction.persistedCount === 1 && realBrowserReconstruction.projects[0].imageUrl === imageUrl, "The identity-transition browser payload must reconstruct Riverside with its upload.");
  assert(reconstructPersistedProjects(JSON.stringify([{ name: project.name }])).issues.length > 0, "Malformed non-empty persisted project state must be rejected instead of reconstructed as zero projects.");

  const first = await routeEditorialInteriorsV1Export(input(reconstructed), decode);
  const second = await routeEditorialInteriorsV1Export(input(reconstructed), decode);
  assert(first.mode === "authored" && first.familyId === "visual-portfolio" && first.packId === "editorial-interiors-v1", "Real-UI Aurelia state must render through Visual authored mode.");
  assert(first.pageOrder.at(-1) === "editorial-interiors-v1.project-feature", "Riverside must receive the authored project feature page.");
  assert(Buffer.from(first.pdf.output("arraybuffer")).equals(Buffer.from(second.mode === "authored" ? second.pdf.output("arraybuffer") : new ArrayBuffer(0))), "Real-UI Aurelia export must be byte deterministic.");
  const raw = Buffer.from(first.pdf.output("arraybuffer")).toString("latin1");
  assert(raw.includes("Riverside Residence") && !/pexels|image credits/i.test(raw), "Authored output must contain Riverside and no legacy contextual markers.");
  const identityTransitionDecision = await routeEditorialInteriorsV1Export(input(realBrowserReconstruction.projects.map((entry) => ({ ...entry, category: entry.category ?? "" }))), decode);
  assert(identityTransitionDecision.mode === "authored" && identityTransitionDecision.familyId === "visual-portfolio", "The exact identity-transition browser state must not reproduce the five-page legacy fallback.");

  const missingImage = await routeEditorialInteriorsV1Export(input([{ ...project, imageUrl: "" }]), decode);
  assert(missingImage.mode === "fallback" && missingImage.reasons.some((reason) => reason.code === "authentic_project_image_metadata_missing"), "A Visual project without its required image must fail explicitly.");
  assert(mustBlockLegacyFallback(1) && !mustBlockLegacyFallback(0), "The UI policy must block legacy fallback only for project-bearing exports.");
  const uiSource = readFileSync(resolve("app/generate/page.tsx"), "utf8");
  const fallbackBlock = uiSource.indexOf("mustBlockLegacyFallback(persistedProjects.persistedCount)");
  const contextualRequest = uiSource.indexOf('"/api/select-visuals"', fallbackBlock);
  assert(fallbackBlock >= 0 && contextualRequest > fallbackBlock, "Project-bearing authored failure must be blocked before contextual API selection and legacy rendering.");

  const malformed = await routeEditorialInteriorsV1Export(input([{ ...project, imageUrl: "data:image/jpeg;base64,malformed" }]), async () => { throw new Error("decode failed"); });
  assert(malformed.mode === "fallback" && malformed.reasons.some((reason) => reason.code === "image_decode_failed"), "Malformed project images must fail deterministically.");
  const oversized = await routeEditorialInteriorsV1Export(input([{ ...project, imageUrl: `data:image/jpeg;base64,${"A".repeat(4_300_000)}` }]), decode);
  assert(oversized.mode === "fallback" && oversized.reasons.some((reason) => reason.code === "image_byte_limit"), "Oversized project images must retain the operational rejection.");

  const mismatched = structuredClone(input()); mismatched.profile.sections.at(-1)!.items[0].name = "Wrong Project";
  const mismatchDecision = await routeEditorialInteriorsV1Export(mismatched, decode);
  assert(mismatchDecision.mode === "fallback" && mismatchDecision.reasons.some((reason) => reason.code === "project_source_mismatch"), "Stale generated project identity must fail explicitly.");

  const deleted = await routeEditorialInteriorsV1Export(input([]), decode);
  assert(deleted.mode !== "authored" || deleted.familyId !== "visual-portfolio", "A deleted project must not survive as a ghost Visual project.");
  const secondProject = { ...project, id: "project:aurelia-second", name: "Courtyard Residence" };
  const multiple = await routeEditorialInteriorsV1Export(input([project, secondProject]), decode);
  assert(multiple.mode === "authored" && multiple.pageOrder.at(-1) === "editorial-interiors-v1.project-grid-2", "Multiple reconstructed projects must preserve source order and fixed grid selection.");
  console.log("Aurelia real-UI persistence, provenance, failure-policy, and authored export tests passed.");
};
main().catch((error) => { console.error(error); process.exitCode = 1; });
