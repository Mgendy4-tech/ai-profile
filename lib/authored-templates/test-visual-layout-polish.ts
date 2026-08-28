import { extractVisualNarrativeFacts } from "./visual-narrative-facts";
import { editorialInteriorsCapabilitiesSupportingTemplate } from "./packs/editorial-interiors-v1/capabilities-supporting";
import { normalizeAuthoredContentUnits } from "./content-shape";
import type { AuthoredDocumentPlan } from "./library-types";
import { createVisualPortfolioDocumentPlan, deriveNextProjectTransitionFromPlan, prepareVisualPortfolioDocumentPlan } from "./visual-portfolio-planner";
import {
  editorialInteriorsSparseNarrativeFacts2Template,
  editorialInteriorsSparseNarrativeFacts3Template,
  editorialInteriorsSparseNarrativeTemplate,
  selectEditorialInteriorsNarrativeTemplate,
} from "./packs/editorial-interiors-v1/narrative";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => { if (!condition) throw new Error(message); };
const company = (overrides: Record<string, string> = {}) => ({ name: "Visual Test Studio", about: "Source-backed sparse narrative.", activities: "Interior design.", experience: "8", industry: "Interior Design & Architecture", customerType: "Residential & Commercial", companyType: "Interior studio", servicesProducts: "Interior design", ...overrides });
const narrative = (facts: ReturnType<typeof extractVisualNarrativeFacts>) => ({ contentId: "about", title: "About Visual Test Studio", body: "A short, truthful source-backed studio narrative that remains within the authored sparse body region.", facts });

const threeFacts = extractVisualNarrativeFacts(company());
assert(threeFacts.length === 3 && threeFacts[0].value === "8 YEARS" && threeFacts[2].value === "RESIDENTIAL & COMMERCIAL", "Three-fact extraction must preserve exact source meaning and fixed priority.");
assert(selectEditorialInteriorsNarrativeTemplate(narrative(threeFacts)).id === editorialInteriorsSparseNarrativeFacts3Template.id, "Sparse narrative plus three facts must select its fixed variant.");
assert(editorialInteriorsSparseNarrativeFacts3Template.prepare(narrative(threeFacts)).compatible, "Three-fact sparse variant must preflight.");
const threePrepared = editorialInteriorsSparseNarrativeFacts3Template.prepare(narrative(threeFacts));
if (!threePrepared.compatible) throw new Error("Expected three-fact preparation.");
const threeAudit = editorialInteriorsSparseNarrativeFacts3Template.render(new jsPDF({ unit: "mm", format: "a4" }), threePrepared.instance);
assert(threeAudit.renderedTextBySlot.fact1Value === (threePrepared.instance.preparedSlots.fact1Value as { lines: readonly string[] }).lines, "Fact renderer must consume the exact prepared line array.");

const twoFacts = extractVisualNarrativeFacts(company({ customerType: "", servicesProducts: "" }));
assert(twoFacts.length === 2 && selectEditorialInteriorsNarrativeTemplate(narrative(twoFacts)).id === editorialInteriorsSparseNarrativeFacts2Template.id, "Missing customer/focus data must select the fixed two-fact variant without a placeholder.");
assert(editorialInteriorsSparseNarrativeFacts2Template.prepare(narrative(twoFacts)).compatible, "Two-fact sparse variant must preflight.");

const noFacts = extractVisualNarrativeFacts(company({ experience: "", industry: "", companyType: "", customerType: "", servicesProducts: "" }));
assert(noFacts.length === 0 && selectEditorialInteriorsNarrativeTemplate(narrative(noFacts)).id === editorialInteriorsSparseNarrativeTemplate.id, "Narrative-only input must select the explicit no-facts sparse variant.");

const missingExperience = extractVisualNarrativeFacts(company({ experience: "" }));
assert(missingExperience.every((fact) => fact.label !== "EXPERIENCE") && missingExperience.length === 2, "Missing experience must not create a blank fact.");
const longIndustry = extractVisualNarrativeFacts(company({ industry: "Interior Architecture and Sustainable Spatial Design" }));
assert(editorialInteriorsSparseNarrativeFacts3Template.prepare(narrative(longIndustry)).compatible, "A realistic long industry label must wrap within the fixed fact envelope.");

const supporting = {
  contentId: "services:supporting", eyebrow: "CAPABILITIES / CONTINUED", heading: "Crafted around every interior.",
  capabilities: [
    { index: "05", title: "Custom Furniture Design", description: "Source-backed capability description.", items: [] },
    { index: "06", title: "Project Coordination", description: "Source-backed capability description.", items: [] },
  ] as const,
  detail: { contentId: "expertise", title: "Residential & Commercial Expertise", body: "Source-backed supporting narrative for residential and commercial work." },
  projectTransition: { label: "NEXT / FEATURED PROJECT" as const, projects: [{ contentId: "project:1", title: "Riverside Residence" }] },
};
const transition = editorialInteriorsCapabilitiesSupportingTemplate.prepare(supporting);
assert(transition.compatible && transition.instance.preparedSlots.transitionProject0Title.kind === "text", "One-project transition must preflight from the source project title.");
if (!transition.compatible) throw new Error("Expected transition preparation.");
assert((transition.instance.preparedSlots.transitionProject0Title as { lines: readonly string[] }).lines.length === 1, "Normal project title must remain one line.");
const transitionAudit = editorialInteriorsCapabilitiesSupportingTemplate.render(new jsPDF({ unit: "mm", format: "a4" }), transition.instance);
assert(transitionAudit.renderedTextBySlot.transitionProject0Title === (transition.instance.preparedSlots.transitionProject0Title as { lines: readonly string[] }).lines, "Transition renderer must consume the exact prepared project-title lines.");
const supportingWithoutTransition = { ...supporting, projectTransition: undefined };
const noTransition = editorialInteriorsCapabilitiesSupportingTemplate.prepare(supportingWithoutTransition);
assert(noTransition.compatible && !("transitionProjects" in noTransition.instance.preparedSlots), "No next project must omit the transition cleanly.");
const twoLine = editorialInteriorsCapabilitiesSupportingTemplate.prepare({ ...supporting, projectTransition: { ...supporting.projectTransition, projects: [{ contentId: "project:1", title: "Riverside Courtyard Residence" }] } });
assert(twoLine.compatible && (twoLine.instance.preparedSlots.transitionProject0Title as { lines: readonly string[] }).lines.length === 2, "Supported two-line project title must prepare as exactly two lines.");
const longestAccepted = editorialInteriorsCapabilitiesSupportingTemplate.prepare({ ...supporting, projectTransition: { ...supporting.projectTransition, projects: [{ contentId: "project:1", title: "Riverside Residential Transformation" }] } });
assert(longestAccepted.compatible, "Supported two-line project titles must remain inside the transition envelope.");
const overlong = editorialInteriorsCapabilitiesSupportingTemplate.prepare({ ...supporting, projectTransition: { ...supporting.projectTransition, projects: [{ contentId: "project:1", title: "Unbrokenprojecttitlethatcannotpossiblyfitinsidethefixedtransitionregion" }] } });
assert(!overlong.compatible, "One-over project title capacity must fail preflight rather than reflow in the renderer.");
const fourTitleCombination = editorialInteriorsCapabilitiesSupportingTemplate.prepare({ ...supporting, projectTransition: { label: "NEXT / SELECTED WORK", projects: [
  { contentId: "project:1", title: "Riverside Residence" }, { contentId: "project:2", title: "Courtyard Apartment" },
  { contentId: "project:3", title: "Harbour Office" }, { contentId: "project:4", title: "Garden Pavilion" },
] } });
assert(fourTitleCombination.compatible, "Supported four-project title combination must fit its fixed authored state.");

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const planningFixture = (count: number) => {
  const projects = Array.from({ length: count }, (_, index) => ({ contentId: `project:${index + 1}`, name: `Interior Study ${index + 1}`, description: "Source-backed project description.", image: { role: "project_image" as const, provenance: "user_upload" as const, format: "PNG" as const, width: 800, height: 800, source: PNG, projectId: `project:${index + 1}` } }));
  const units = normalizeAuthoredContentUnits({ company: {}, sections: [
    { id: "about", role: "narrative", content: "Source-backed sparse narrative." },
    { id: "services", role: "services", items: Array.from({ length: 6 }, (_, index) => ({ id: `service:${index + 1}` })) },
    { id: "expertise", role: "expertise", content: supporting.detail.body },
  ], projects: projects.map((project) => ({ id: project.contentId, hasAuthenticImage: true })) });
  return { units, cover: { contentId: "company", documentLabel: "COMPANY PROFILE", companyName: "Visual Test Studio", hero: projects[0].image }, narrative: narrative([]), capabilities: { contentId: "services", eyebrow: "02 / CAPABILITIES", heading: "Capabilities", supportingLine: "Source-backed capabilities.", capabilities: Array.from({ length: 4 }, (_, index) => ({ index: `0${index + 1}`, title: `Capability ${index + 1}`, description: "Source-backed capability.", items: [] })) as never }, capabilitiesSupporting: supportingWithoutTransition, details: [{ contentId: "expertise", title: supporting.detail.title, body: supporting.detail.body }], projects };
};

for (const count of [1, 2, 3, 4, 5, 8]) {
  const result = createVisualPortfolioDocumentPlan(planningFixture(count));
  assert(result.compatible, `${count}-project transition fixture must plan.`);
  if (!result.compatible) throw new Error(`Expected ${count}-project transition plan.`);
  const page4Index = result.plan.pages.findIndex((page) => page.pageId === "capabilities:supporting");
  const page4 = result.plan.pages[page4Index];
  const nextProjectPage = result.plan.pages.slice(page4Index + 1).find((page) => page.pageRole === "project_feature" || page.pageRole === "project_grid" || page.pageId.startsWith("projects:"));
  const plannedTransition = (page4.candidate as typeof supporting).projectTransition;
  const nextIds = nextProjectPage?.claims.filter((claim) => claim.mode === "consume").map((claim) => claim.contentId) ?? [];
  assert(plannedTransition?.projects.map((project) => project.contentId).join("|") === nextIds.join("|"), `${count}-project transition IDs must exactly match the immediately following project-bearing page.`);
  assert(plannedTransition?.projects.map((project) => project.title).join("|") === planningFixture(count).projects.slice(0, Math.min(count, 4)).map((project) => project.name).join("|"), `${count}-project transition titles must exactly match the next project-page candidates.`);
  assert(page4.claims.filter((claim) => claim.mode === "reference").map((claim) => claim.contentId).join("|") === nextIds.join("|"), `${count}-project Page 4 claims must reference the next page without consuming it.`);
  assert(nextProjectPage?.claims.every((claim) => claim.mode === "consume"), `${count}-project titles must remain consumed only on their project page.`);
  const preparedPlan = prepareVisualPortfolioDocumentPlan(result.plan);
  assert(preparedPlan.compatible, `${count}-project transition must satisfy fixed preflight capacity.`);
}

const pagesWithoutProjects = [{ pageId: "capabilities:supporting", templateId: "editorial-interiors-v1.capabilities-supporting-2", pageRole: "continuation", candidate: supportingWithoutTransition, claims: [] }] as unknown as AuthoredDocumentPlan["pages"];
assert(deriveNextProjectTransitionFromPlan(pagesWithoutProjects, 0) === undefined, "A plan with no later project-bearing page must produce no transition.");

console.log("Visual sparse About and project-transition polish tests passed.");
import { jsPDF } from "jspdf";
