import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { validateGeneratedProfileSections, type GeneratedProfileSection, type SelectedProfileSection } from "../generated-profile-boundary";
import { validateDocumentCoverage } from "./coverage";
import { createContentShape, normalizeAuthoredContentUnits } from "./content-shape";
import { enrichProductionContentForAuthoredTemplates } from "./enrichment";
import { routeEditorialInteriorsV1Export } from "./export-orchestrator";
import { explainAuthoredTemplateFamilyRanking } from "./family-ranking";
import { createVisualPortfolioDocumentPlan, prepareVisualPortfolioDocumentPlan } from "./visual-portfolio-planner";
import { authoredTemplateFamilies } from "./registry";
import { normalizeProductionSectionRoles } from "./section-role-normalization";
import { editorialInteriorsV1Pack } from "./packs/editorial-interiors-v1";
import { selectAuthoredCover } from "./cover-library";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => { if (!condition) throw new Error(message); };
const fixtureBytes = readFileSync(resolve("lib/test-fixtures/visual/aurelia-browser-upload.jpg"));
const imageUrl = `data:image/jpeg;base64,${fixtureBytes.toString("base64")}`;
const project = {
  id: "1787833014357-Riverside Residence",
  name: "Riverside Residence",
  category: "residential",
  description: "Contemporary residential interior focused on warm materials, natural light, and functional open-plan living.",
  imageUrl,
};
const company = {
  name: "Aurelia Interiors",
  about: "Aurelia Interiors is an interior design studio creating refined residential and commercial spaces with a focus on material quality, functional planning, and contemporary visual identity. The studio develops tailored design solutions that balance aesthetics, comfort, and practical use.",
  activities: "Interior design, space planning, residential interiors, commercial interiors, material selection, and project styling.",
  experience: "",
};
const selected: SelectedProfileSection[] = [
  { id: "about", displayTitle: "About Aurelia Interiors", description: "Introduce the studio and its approach to refined, functional, and contemporary interior design." },
  { id: "services", displayTitle: "Interior Design Services", description: "Present interior design, space planning, material selection, and project styling services.", semanticRole: "services" },
  { id: "expertise", displayTitle: "Residential & Commercial Expertise", description: "Describe the studio's expertise in creating tailored residential and commercial interiors." },
  { id: "projects", displayTitle: "Featured Projects", description: "Showcase Riverside Residence and other provided projects through their design focus, category, and description." },
];
const generated: GeneratedProfileSection[] = [
  { id: "about", title: selected[0].displayTitle, description: selected[0].description, content: company.about, items: [] },
  { id: "services", title: selected[1].displayTitle, description: selected[1].description, content: company.activities, items: [
    { id: "services:service:1", name: "Interior Design", description: "Interior design for refined residential and commercial spaces.", sourceEvidence: "Interior design" },
    { id: "services:service:2", name: "Space Planning", description: "Space planning that balances functional planning and practical use.", sourceEvidence: "space planning" },
    { id: "services:service:3", name: "Interior Styling", description: "Interior styling for contemporary residential and commercial interiors.", sourceEvidence: "interior styling" },
    { id: "services:service:4", name: "Material Selection", description: "Material selection with a focus on material quality.", sourceEvidence: "material selection" },
    { id: "services:service:5", name: "Custom Furniture Design", description: "Custom furniture design tailored to residential and commercial interiors.", sourceEvidence: "custom furniture" },
    { id: "services:service:6", name: "Project Coordination", description: "Project coordination for practical interior delivery.", sourceEvidence: "project coordination" },
  ] },
  { id: "expertise", title: selected[2].displayTitle, description: selected[2].description, content: "Aurelia Interiors creates tailored residential and commercial interiors that balance aesthetics, comfort, functional planning, and practical use.", items: [] },
  { id: "projects", title: selected[3].displayTitle, description: selected[3].description, content: "Riverside Residence is a contemporary residential interior focused on warm materials, natural light, and functional open-plan living.", items: [{ id: project.id, name: project.name, description: project.description, imageUrl }] },
];

const main = async () => {
  const boundary = validateGeneratedProfileSections(selected, generated, { serviceSourceMaterial: [company.about, company.activities, "Interior styling, custom furniture, project coordination"] });
  assert(boundary.valid, `Generated-profile boundary failed: ${JSON.stringify(boundary.diagnostics)}`);
  const profile = { companyName: company.name, companyType: "Interior design studio", sections: boundary.sections };
  const normalized = normalizeProductionSectionRoles(profile.sections);
  assert(normalized.diagnostics.length === 0, `Normalization failed: ${JSON.stringify(normalized.diagnostics)}`);
  assert(normalized.sections.map(({ section, role }) => `${section.id}:${role}`).join("|") === "about:narrative|services:services|expertise:expertise|projects:projects", "Aurelia roles changed or collided.");

  const input = { company, profile, projects: [project] };
  const enriched = await enrichProductionContentForAuthoredTemplates(input, async () => ({ width: 1600, height: 1200 }));
  assert(enriched.diagnostics.length === 0, `Enrichment failed: ${JSON.stringify(enriched.diagnostics)}`);
  const visual = enriched.adapterInput.projectVisuals[0];
  assert(visual?.projectId === project.id && visual.provenance === "user_upload" && visual.role === "project_image", "Authentic project image lost provenance or association.");

  const units = normalizeAuthoredContentUnits({ company: {}, sections: [
    { id: "about", role: "narrative", content: generated[0].content },
    { id: "services", role: "services", items: generated[1].items.map((_, index) => ({ id: `services:item:${index}` })) },
    { id: "expertise", role: "expertise", content: generated[2].content },
  ], projects: [{ id: project.id, hasAuthenticImage: true }] });
  const ranking = explainAuthoredTemplateFamilyRanking(authoredTemplateFamilies, createContentShape(units));
  assert(ranking.selectedFamilyId === "visual-portfolio", `Visual must rank first: ${JSON.stringify(ranking)}`);
  const coverSelection = selectAuthoredCover({ familyId: "visual-portfolio", companyName: company.name, companyType: profile.companyType, hasLogo: false });
  assert(coverSelection.compatible && coverSelection.templateId === "authored-cover-v1.editorial-warm", "Aurelia must select the image-free editorial cover.");
  const image = { role: visual.role, provenance: visual.provenance, format: visual.format, width: visual.width, height: visual.height, source: visual.imageUrl, projectId: project.id } as const;
  const planning = createVisualPortfolioDocumentPlan({
    units,
    cover: { contentId: "company", documentLabel: "COMPANY PROFILE", companyName: company.name, companyType: profile.companyType, paletteId: coverSelection.paletteId }, coverTemplateId: coverSelection.templateId,
    narrative: { contentId: "about", title: generated[0].title, body: generated[0].content },
    capabilities: { contentId: "services", eyebrow: "02 / CAPABILITIES", heading: generated[1].title, supportingLine: generated[1].description, capabilities: generated[1].items.slice(0, 4).map((item, index) => ({ index: String(index + 1).padStart(2, "0"), title: item.name, description: item.description, items: [] })) as never },
    capabilitiesSupporting: { contentId: "services:supporting", eyebrow: "CAPABILITIES / CONTINUED", heading: "Crafted around every interior.", capabilities: generated[1].items.slice(4).map((item, index) => ({ index: String(index + 5).padStart(2, "0"), title: item.name, description: item.description, items: [] })) as never, detail: { contentId: "expertise", title: generated[2].title, body: generated[2].content }, featuredProjectTitle: project.name },
    details: [{ contentId: "expertise", title: generated[2].title, body: generated[2].content }],
    projects: [{ contentId: project.id, name: project.name, description: project.description, image }],
  });
  assert(planning.compatible, `Planning failed: ${JSON.stringify(planning.issues)}`);
  const coverage = validateDocumentCoverage(units, planning.plan);
  assert(coverage.complete, `Coverage failed: ${JSON.stringify(coverage.issues)}`);
  assert(coverage.consumedContentIds.filter((id) => id === project.id).length === 1, "Project must be consumed exactly once.");
  assert(planning.plan.pages[0].claims.every((claim) => claim.contentId !== project.id), "Riverside must not be referenced by the cover.");
  const prepared = prepareVisualPortfolioDocumentPlan(planning.plan);
  assert(prepared.compatible, `Preflight failed: ${JSON.stringify(prepared.issues)}`);
  assert(planning.plan.pages.length === 5 && planning.plan.pages[3].templateId === "editorial-interiors-v1.capabilities-supporting-2", "Six-service Aurelia must use the intentional fixed five-page composition.");
  const capabilityTemplates = planning.plan.pages.slice(2, 4).map((page) => editorialInteriorsV1Pack.templates.find((template) => template.id === page.templateId));
  assert(capabilityTemplates.every((template) => template && template.envelope.slots.every((slot) => slot.kind !== "image")), "No-media capability variants must not expose an empty image placeholder.");

  const first = await routeEditorialInteriorsV1Export(input, async () => ({ width: 1600, height: 1200 }));
  const second = await routeEditorialInteriorsV1Export(input, async () => ({ width: 1600, height: 1200 }));
  assert(first.mode === "authored" && second.mode === "authored", `Export fell back: ${JSON.stringify(first.reasons)}`);
  assert(first.familyId === "visual-portfolio" && first.packId === "editorial-interiors-v1", "Wrong authored family or pack.");
  const bytes = Buffer.from(first.pdf.output("arraybuffer"));
  assert(bytes.equals(Buffer.from(second.pdf.output("arraybuffer"))), "Identical input must produce a byte-identical PDF.");
  const rawPdf = bytes.toString("latin1");
  assert(rawPdf.includes("COMPANY PROFILE") && rawPdf.includes("Riverside Residence"), "Authored Visual markers are missing.");
  assert(!/pexels|image credits/i.test(rawPdf), "Legacy Pexels/image-credit marker found.");
  const outputPath = resolve("artifacts/manual-review/visual-portfolio-v1-deployed-aurelia-fixed-review.pdf");
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, bytes);
  console.log(JSON.stringify({
    generation: { inputIds: selected.map((section) => section.id), outputIds: boundary.sections.map((section) => section.id), diagnostics: boundary.diagnostics },
    projects: { count: 1, ids: [project.id], visual: { provenance: visual.provenance, role: visual.role, projectId: visual.projectId, width: visual.width, height: visual.height } },
    normalization: { output: normalized.sections.map(({ section, role }) => ({ id: section.id, role })), diagnostics: normalized.diagnostics },
    units,
    ranking,
    plan: planning.plan.pages.map((page) => ({ pageId: page.pageId, templateId: page.templateId, claims: page.claims })),
    coverage,
    preflight: { compatible: prepared.compatible, pageCount: prepared.prepared.instances.length },
    decision: { mode: first.mode, familyId: first.familyId, packId: first.packId, pageOrder: first.pageOrder, reasons: first.reasons },
    pdf: { path: outputPath, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), byteIdentical: true, legacyMarkers: false },
  }, null, 2));
};

main().catch((error) => { console.error(error); process.exitCode = 1; });
