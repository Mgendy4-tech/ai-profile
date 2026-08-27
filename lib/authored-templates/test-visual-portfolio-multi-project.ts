import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { normalizeAuthoredContentUnits } from "./content-shape";
import { validateDocumentCoverage } from "./coverage";
import { normalizeProductionSectionRoles } from "./section-role-normalization";
import type { AuthoredDocumentPlan } from "./library-types";
import type { ImageSlotValue } from "./types";
import { prepareEditorialInteriorsV1Document, renderPreparedEditorialInteriorsV1Document } from "./packs/editorial-interiors-v1";
import type { EditorialInteriorsV1DocumentInput } from "./packs/editorial-interiors-v1/content";
import { editorialInteriorsProjectTextGeometry, type PortfolioProjectContent } from "./packs/editorial-interiors-v1/portfolio-project-pages";
import { createVisualPortfolioDocumentPlan, prepareVisualPortfolioDocumentPlan, renderPreparedVisualPortfolioPlan } from "./visual-portfolio-planner";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const REVIEW_IMAGE_BUFFER = readFileSync(resolve("lib", "test-fixtures", "visual", "aurelia-user-upload.png"));
const REVIEW_IMAGE = `data:image/png;base64,${REVIEW_IMAGE_BUFFER.toString("base64")}`;
const image = (projectId: string): ImageSlotValue & { projectId: string } => ({ role: "project_image", provenance: "user_upload", format: "PNG", width: REVIEW_IMAGE_BUFFER.readUInt32BE(16), height: REVIEW_IMAGE_BUFFER.readUInt32BE(20), source: REVIEW_IMAGE, projectId });

const base = () => ({
  cover: { contentId: "company", documentLabel: "COMPANY PROFILE", companyName: "Aurelia Interior Studio", hero: image("project:1") },
  narrative: { contentId: "about", title: "About Aurelia", body: "Clearly labelled fictional PoC narrative used only to test the production-quality authored portfolio family." },
  capabilities: { contentId: "services", eyebrow: "02 / CAPABILITIES", heading: "Capabilities", supportingLine: "Clearly labelled fictional PoC service content.", capabilities: [
    { index: "01", title: "Spatial Planning", description: "Fictional PoC service description.", items: [] },
    { index: "02", title: "Material Direction", description: "Fictional PoC service description.", items: [] },
    { index: "03", title: "Interior Detailing", description: "Fictional PoC service description.", items: [] },
    { index: "04", title: "Visual Curation", description: "Fictional PoC service description.", items: [] },
  ] as const },
});

const fixture = (count: number) => {
  const projects: PortfolioProjectContent[] = Array.from({ length: count }, (_, index) => ({
    contentId: `project:${index + 1}`,
    name: `Fictional Interior Study ${String(index + 1).padStart(2, "0")}`,
    description: "Clearly labelled fictional PoC project description for visual and capacity review.",
    image: image(`project:${index + 1}`),
  }));
  const units = normalizeAuthoredContentUnits({
    company: {},
    sections: [
      { id: "about", role: "narrative", content: base().narrative.body },
      { id: "services", role: "services", items: [0, 1, 2, 3].map((index) => ({ id: `service:${index + 1}` })) },
    ],
    projects: projects.map((project) => ({ id: project.contentId, hasAuthenticImage: true })),
  });
  return { ...base(), projects, units };
};

const expectedProjectTemplates: Record<number, readonly string[]> = {
  1: ["editorial-interiors-v1.project-feature"],
  2: ["editorial-interiors-v1.project-grid-2"],
  3: ["editorial-interiors-v1.project-grid-3"],
  4: ["editorial-interiors-v1.project-grid-4"],
  5: ["editorial-interiors-v1.project-grid-4", "editorial-interiors-v1.portfolio-continuation-1"],
  6: ["editorial-interiors-v1.project-grid-4", "editorial-interiors-v1.portfolio-continuation-2"],
  7: ["editorial-interiors-v1.project-grid-4", "editorial-interiors-v1.portfolio-continuation-3"],
  8: ["editorial-interiors-v1.project-grid-4", "editorial-interiors-v1.portfolio-continuation-4"],
  9: ["editorial-interiors-v1.project-grid-4", "editorial-interiors-v1.portfolio-continuation-4", "editorial-interiors-v1.portfolio-continuation-1"],
  12: ["editorial-interiors-v1.project-grid-4", "editorial-interiors-v1.portfolio-continuation-4", "editorial-interiors-v1.portfolio-continuation-4"],
};

for (const count of [1, 2, 3, 4, 5, 6, 7, 8, 9, 12]) {
  const input = fixture(count);
  const result = createVisualPortfolioDocumentPlan(input);
  assert(result.compatible, `${count} projects must produce a complete Visual plan.`);
  if (!result.compatible) throw new Error(`Expected ${count}-project plan.`);
  const projectPages = result.plan.pages.slice(3);
  assert(projectPages.map((page) => page.templateId).join("|") === expectedProjectTemplates[count].join("|"), `${count}-project template order must be fixed and deterministic.`);
  assert(projectPages.flatMap((page) => page.claims.filter((claim) => claim.mode === "consume").map((claim) => claim.contentId)).join("|") === input.projects.map((project) => project.contentId).join("|"), `${count} projects must remain in stable source order and be consumed exactly once.`);
  assert(validateDocumentCoverage(input.units, result.plan).complete, `${count}-project plan must pass the generic coverage ledger.`);
  assert(JSON.stringify(result) === JSON.stringify(createVisualPortfolioDocumentPlan(input)), `${count}-project planning must be deterministic.`);
  assert(result.plan.pages.every((page) => !("x" in page) && !("columns" in page) && !("geometry" in page) && !("layout" in page)), "Plans must not contain geometry or dynamic layout parameters.");
  const prepared = prepareVisualPortfolioDocumentPlan(result.plan);
  assert(prepared.compatible, `${count}-project fixed templates must pass preflight.`);
}

Object.entries(editorialInteriorsProjectTextGeometry).forEach(([templateId, cells]) => {
  cells.forEach((cell, index) => {
    assert(cell.titleMaxLines === 2, `${templateId} project ${index + 1} must reserve two fixed title lines.`);
    assert(cell.clearanceMm > 0, `${templateId} project ${index + 1} must keep a positive title/description clearance.`);
  });
});

const twoLineLead = fixture(2);
twoLineLead.projects[0].name = "Aurelia Courtyard Residence and Material Study";
const twoLinePlan = createVisualPortfolioDocumentPlan(twoLineLead);
if (!twoLinePlan.compatible) throw new Error("Expected two-line lead project plan.");
const twoLinePrepared = prepareVisualPortfolioDocumentPlan(twoLinePlan.plan);
assert(twoLinePrepared.compatible, "Two-line lead project title must pass deterministic preflight.");
if (!twoLinePrepared.compatible) throw new Error("Expected prepared two-line lead project.");
const leadTitle = twoLinePrepared.prepared.instances[3].preparedSlots.project0Name;
assert(leadTitle.kind === "text" && leadTitle.lines.length === 2, "Lead project regression title must prepare as exactly two lines.");
if (leadTitle.kind !== "text") throw new Error("Expected prepared lead project title text.");
const twoLineRender = renderPreparedVisualPortfolioPlan(twoLinePrepared.prepared);
assert(twoLineRender.audits[3].renderedTextBySlot.project0Name === leadTitle.lines, "Two-line lead title must render from the exact preflight lines.");

const thirteen = createVisualPortfolioDocumentPlan(fixture(13));
assert(thirteen.compatible && thirteen.plan.pages.slice(3).flatMap((page) => page.claims.filter((claim) => claim.mode === "consume")).length === 13, "Thirteen and larger project sets must use repeated fixed continuations without truncation.");

const missingImage = fixture(2); delete (missingImage.projects[1] as Partial<PortfolioProjectContent>).image;
const missingPreparedPlan = createVisualPortfolioDocumentPlan(missingImage);
assert(missingPreparedPlan.compatible, "Semantic planning may succeed before slot preflight detects a missing image.");
if (missingPreparedPlan.compatible) assert(!prepareVisualPortfolioDocumentPlan(missingPreparedPlan.plan).compatible, "Missing authentic project imagery must fail template preflight.");

const contextual = fixture(2); contextual.projects[1].image = { ...contextual.projects[1].image, role: "contextual_stock", provenance: "pexels" };
const contextualPlan = createVisualPortfolioDocumentPlan(contextual);
assert(contextualPlan.compatible && !prepareVisualPortfolioDocumentPlan(contextualPlan.plan).compatible, "Contextual stock must be rejected from every project page.");

const wrongAssociation = fixture(2); wrongAssociation.projects[1].image = image("project:1");
const wrongPlan = createVisualPortfolioDocumentPlan(wrongAssociation);
assert(wrongPlan.compatible, "Association is a template-preflight concern after semantic planning.");
if (wrongPlan.compatible) {
  const wrongPrepared = prepareVisualPortfolioDocumentPlan(wrongPlan.plan);
  assert(!wrongPrepared.compatible && wrongPrepared.issues.some((issue) => issue.code === "image_project_association_mismatch"), "A project must never receive another project's image.");
}

const claimsFixture = fixture(2); const claimsPlan = createVisualPortfolioDocumentPlan(claimsFixture);
if (!claimsPlan.compatible) throw new Error("Expected claims plan.");
const repeatedReference = structuredClone(claimsPlan.plan);
repeatedReference.pages[1].claims = [...repeatedReference.pages[1].claims, { contentId: "project:1", mode: "reference", slotId: "editorialReference" }];
assert(validateDocumentCoverage(claimsFixture.units, repeatedReference).complete, "Repeated project references must not duplicate consumption.");
const duplicateConsume = structuredClone(claimsPlan.plan); duplicateConsume.pages[1].claims = [...duplicateConsume.pages[1].claims, { contentId: "project:1", mode: "consume", slotId: "duplicate" }];
assert(validateDocumentCoverage(claimsFixture.units, duplicateConsume).issues.some((issue) => issue.code === "duplicate_content_consumption"), "Duplicate project consumption must fail.");
const unknownClaim = structuredClone(claimsPlan.plan); unknownClaim.pages[1].claims = [...unknownClaim.pages[1].claims, { contentId: "project:unknown", mode: "consume", slotId: "unknown" }];
assert(validateDocumentCoverage(claimsFixture.units, unknownClaim).issues.some((issue) => issue.code === "unknown_content_claim"), "Unknown project claims must fail.");

const sections = [
  { id: "about", title: "About", description: "Narrative section", content: "Narrative", items: [] },
  { id: "expertise", title: "Expertise", description: "Services section", content: "Services", items: [] },
  { id: "projects", title: "Projects", description: "Projects section", content: "Portfolio", items: [] },
];
const normalized = normalizeProductionSectionRoles(sections);
assert(normalized.sections.map((entry) => entry.role).join("|") === "narrative|services|projects" && normalized.diagnostics.length === 0, "Known production IDs must normalize deterministically.");
const normalizationFailures = normalizeProductionSectionRoles([...sections, { id: "about-services", title: "Ambiguous", description: "", content: "", items: [] }, { id: "team", title: "Team", description: "", content: "", items: [] }, { id: "overview", title: "Second narrative", description: "", content: "", items: [] }]);
assert(normalizationFailures.diagnostics.map((entry) => entry.code).join("|") === "ambiguous_semantic_role|unknown_semantic_role|duplicate_role_candidate", "Ambiguous, unknown, and duplicate roles must have stable ordered diagnostics.");

const one = fixture(1); const onePlan = createVisualPortfolioDocumentPlan(one);
if (!onePlan.compatible) throw new Error("Expected one-project plan.");
const onePrepared = prepareVisualPortfolioDocumentPlan(onePlan.plan);
if (!onePrepared.compatible) throw new Error("Expected one-project preparation.");
const plannedPdf = renderPreparedVisualPortfolioPlan(onePrepared.prepared).pdf;
const legacyInput: EditorialInteriorsV1DocumentInput = { cover: one.cover, narrative: one.narrative, capabilities: one.capabilities, projectFeature: { contentId: one.projects[0].contentId, title: one.projects[0].name, hero: one.projects[0].image, overviewBody: one.projects[0].description } };
const legacyPrepared = prepareEditorialInteriorsV1Document(legacyInput);
if (!legacyPrepared.compatible) throw new Error("Expected existing one-project preparation.");
const legacyPdf = renderPreparedEditorialInteriorsV1Document(legacyPrepared.document).pdf;
assert(Buffer.from(plannedPdf.output("arraybuffer")).equals(Buffer.from(legacyPdf.output("arraybuffer"))), "One-project output must remain byte-identical to the proven pack renderer.");

for (const count of [2, 4, 8, 12]) {
  const result = createVisualPortfolioDocumentPlan(fixture(count));
  if (!result.compatible) throw new Error(`Expected review plan for ${count}.`);
  const prepared = prepareVisualPortfolioDocumentPlan(result.plan);
  if (!prepared.compatible) throw new Error(`Expected review preparation for ${count}.`);
  const pdf = renderPreparedVisualPortfolioPlan(prepared.prepared).pdf;
  const output = resolve("artifacts", "manual-review", `visual-portfolio-${count}-project-review.pdf`);
  mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, Buffer.from(pdf.output("arraybuffer")));
}

console.log("Visual / Portfolio multi-project and section-role normalization tests passed.");
