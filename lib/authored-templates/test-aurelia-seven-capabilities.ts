import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { reconstructPersistedProjects } from "../persisted-projects";
import { enrichProductionContentForAuthoredTemplates } from "./enrichment";
import { routeEditorialInteriorsV1Export } from "./export-orchestrator";

const imageBytes = readFileSync(resolve("lib/test-fixtures/visual/aurelia-browser-upload.jpg"));
const imageUrl = `data:image/jpeg;base64,${imageBytes.toString("base64")}`;
const project = { id: "project:aurelia-riverside-seven", name: "Riverside Residence", category: "Residential Interior", description: "A contemporary residential interior shaped through warm natural materials, layered lighting, custom furniture, and a calm neutral palette.", imageUrl };
const capabilityNames = ["Interior Design", "Space Planning", "Material Selection", "Furniture Selection", "Lighting Design", "Styling", "Project Coordination"];
const company = { name: "Aurelia Interiors", logoUrl: "", about: "Aurelia creates refined residential interiors.", companyType: "Interior studio", industry: "Residential interiors", customerType: "Residential clients", servicesProducts: "Seven supplied capabilities", activities: "Seven supplied capabilities", experience: "8" };
const sectionsFor = (count: number) => [
  { id: "about", title: "About Aurelia", description: "Source-backed studio overview.", content: "Aurelia Interiors creates refined residential interiors around warm natural materials and calm neutral palettes.", items: [] },
  { id: "services", title: "Capabilities", description: "Source-backed interior capabilities.", content: "Seven supplied capability records.", items: capabilityNames.slice(0, count).map((name, index) => ({ name, description: `Source-backed capability description ${index + 1}.` })) },
  { id: "expertise", title: "Residential Expertise", description: "Source-backed expertise.", content: "Residential expertise grounded in the supplied project information.", items: [] },
  { id: "approach", title: "Design Approach", description: "Source-backed approach.", content: "A calm, material-led design approach grounded in supplied information.", items: [] },
  { id: "projects", title: "Selected Projects", description: "Source-backed completed work.", content: project.description, items: [{ name: project.name, description: project.description }] },
];
const inputFor = (count: number) => ({ company, profile: { companyName: company.name, companyType: company.companyType, sections: sectionsFor(count) }, projects: reconstructPersistedProjects(JSON.stringify([project])).projects });
const decode = async () => ({ width: 1600, height: 1200 });

const main = async () => {
  const input = inputFor(7);
  const enriched = await enrichProductionContentForAuthoredTemplates(input, decode);
  assert.deepEqual(enriched.adapterInput.projectVisuals[0], { role: "project_image", provenance: "user_upload", projectId: project.id, imageUrl, format: "JPEG", width: 1600, height: 1200, aspectRatio: 4 / 3 });
  const first = await routeEditorialInteriorsV1Export(input, decode);
  const second = await routeEditorialInteriorsV1Export(input, decode);
  assert.equal(first.mode, "authored", `Seven-capability Aurelia rejected: ${first.mode === "fallback" ? JSON.stringify(first.reasons) : ""}`);
  assert.equal(first.familyId, "visual-portfolio"); assert.equal(first.packId, "editorial-interiors-v1");
  assert(first.pageOrder.includes("editorial-interiors-v1.capabilities-continuation-3"), "Seven capabilities must select the fixed three-item continuation variant.");
  assert.equal(first.pdf.getNumberOfPages(), 7);
  const firstBytes = Buffer.from(first.pdf.output("arraybuffer")); const secondBytes = Buffer.from(second.mode === "authored" ? second.pdf.output("arraybuffer") : new ArrayBuffer(0));
  assert(firstBytes.equals(secondBytes), "Seven-capability Aurelia PDF must be byte deterministic.");
  const raw = firstBytes.toString("latin1");
  capabilityNames.forEach((name) => assert.equal(raw.split(name).length - 1, 1, `${name} must render exactly once.`));
  assert(raw.includes("Riverside Residence") && raw.includes("/Subtype /Image"), "Riverside text and uploaded raster must render on the project page.");
  assert(!/pexels|image credits/i.test(raw), "No contextual imagery or image credits may enter Visual authored output.");

  for (let count = 4; count <= 12; count += 1) {
    const names = Array.from({ length: count }, (_, index) => capabilityNames[index] ?? `Additional Capability ${index + 1}`);
    const rangeInput = inputFor(7); rangeInput.profile.sections[1] = { ...rangeInput.profile.sections[1], content: `${count} supplied capability records.`, items: names.map((name, index) => ({ name, description: `Source-backed capability description ${index + 1}.` })) };
    const decision = await routeEditorialInteriorsV1Export(rangeInput, decode);
    assert.equal(decision.mode, "authored", `Visual V1 capability count ${count} must be authored.`);
  }
  console.log(JSON.stringify({ previousSupportedCounts: [4, 6], newSupportedCounts: "4-12", sevenCapabilityVariant: "editorial-interiors-v1.capabilities-continuation-3", pageCount: first.pdf.getNumberOfPages(), exactOnce: capabilityNames, project: { id: project.id, name: project.name, role: "project_image", provenance: "user_upload" }, deterministic: true, pexels: false, imageCredits: false }));
};
main().catch((error) => { console.error(error); process.exitCode = 1; });
