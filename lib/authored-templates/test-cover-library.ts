import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { jsPDF } from "jspdf";
import { authoredCoverPalettes, authoredCoverTemplateDefinitions, authoredCoverTemplates, getAuthoredCoverTemplate, normalizeCoverStyleDescriptor, selectAuthoredCover, type AuthoredCoverContent } from "./cover-library";
import { routeEditorialInteriorsV1Export } from "./export-orchestrator";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => { if (!condition) throw new Error(message); };
assert(authoredCoverTemplateDefinitions.length === 6 && new Set(authoredCoverTemplateDefinitions.map((entry) => entry.id)).size === 6, "Six unique authored covers must be registered.");
assert(authoredCoverPalettes.length >= 6 && new Set(authoredCoverPalettes.map((entry) => entry.id)).size === authoredCoverPalettes.length, "Curated palette IDs must be unique.");
const luminance = (rgb: readonly [number, number, number]) => { const channel = (value: number) => { const scaled = value / 255; return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4; }; return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]); };
authoredCoverPalettes.forEach((entry) => { const light = Math.max(luminance(entry.background), luminance(entry.ink)); const dark = Math.min(luminance(entry.background), luminance(entry.ink)); assert((light + 0.05) / (dark + 0.05) >= 4.5, `${entry.id} must preserve deterministic readable contrast.`); });
assert(authoredCoverTemplates.every((template) => template.envelope.slots.every((slot) => slot.kind !== "image" || slot.id === "logo")), "Authored covers may contain only the optional logo raster slot.");

const facts = [
  { expected: "authored-cover-v1.editorial-warm", palette: "warm-neutral", input: { familyId: "visual-portfolio" as const, companyName: "Aurelia Interiors", companyType: "Interior design studio", industry: "Interior Design", styleDescriptor: "elegant", hasLogo: true } },
  { expected: "authored-cover-v1.corporate-clean", palette: "navy-clean", input: { familyId: "corporate-services" as const, companyName: "Northbridge Advisory", companyType: "Business Consulting & Advisory Services", industry: "Management Consulting", styleDescriptor: "minimal", hasLogo: false } },
  { expected: "authored-cover-v1.dynamic-bold", palette: "tech-electric", input: { familyId: "product-tech" as const, companyName: "WinX", companyType: "Sales Technology Company", industry: "Sales Technology", styleDescriptor: "technical", hasLogo: true } },
] as const;
facts.forEach(({ input, expected, palette }) => { const first = selectAuthoredCover(input); const second = selectAuthoredCover(input); assert(first.compatible && second.compatible && first.templateId === expected && first.paletteId === palette && JSON.stringify(first) === JSON.stringify(second), `${input.companyName} cover selection must be deterministic.`); });
assert(normalizeCoverStyleDescriptor(undefined) === null && normalizeCoverStyleDescriptor("not-a-style") === null && normalizeCoverStyleDescriptor(" Elegant ") === "elegant", "Style descriptors must normalize into the bounded enum.");
assert(selectAuthoredCover({ familyId: "corporate-services", companyName: "A", companyType: "Consulting", hasLogo: false }).compatible, "Short names must select safely.");
assert(selectAuthoredCover({ familyId: "corporate-services", companyName: "Northbridge Advisory and Strategic Operations Partners International", companyType: "Consulting", hasLogo: false }).compatible, "Supported long names must select safely.");
assert(!selectAuthoredCover({ familyId: "corporate-services", companyName: "A".repeat(73), companyType: "Consulting", hasLogo: false }).compatible, "One-over maximum name capacity must reject deterministically.");
const cleanTemplate = getAuthoredCoverTemplate("authored-cover-v1.corporate-clean"); assert(cleanTemplate, "Clean cover template must be registered.");
const overflow = cleanTemplate.prepare({ contentId: "overflow", documentLabel: "COMPANY PROFILE", companyName: "A".repeat(73), companyType: "Consulting", paletteId: "navy-clean" }); assert(!overflow.compatible && overflow.issues[0]?.code === "text_line_limit_exceeded", "One-over name input must fail cover preflight deterministically.");

const logoBytes = readFileSync(resolve("lib/test-fixtures/logos/brand-square-transparent.png"));
const logo = { role: "company_logo" as const, provenance: "user_upload" as const, format: "PNG" as const, width: logoBytes.readUInt32BE(16), height: logoBytes.readUInt32BE(20), source: `data:image/png;base64,${logoBytes.toString("base64")}` };
const renderContactSheet = (withLogos: boolean) => {
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" }); pdf.setCreationDate(new Date("2000-01-01T00:00:00.000Z")); pdf.setFileId("00000000000000000000000000000000");
  const names = ["Aurelia Interiors", "Northbridge Advisory", "Vertex Motion", "Atlas Engineering", "Maison Orée", "Luma Creative Studio"];
  authoredCoverTemplates.forEach((template, index) => { if (index) pdf.addPage("a4", "portrait"); const definition = authoredCoverTemplateDefinitions[index]; const candidate: AuthoredCoverContent = { contentId: `cover:${index}`, documentLabel: "COMPANY PROFILE", companyName: names[index], companyType: definition.compositionCategory.replaceAll("-", " "), paletteId: definition.paletteIds[0], ...(withLogos && index % 2 === 0 ? { logo } : {}) }; const prepared = template.prepare(candidate); assert(prepared.compatible, `${template.id} representative cover must preflight.`); const audit = template.render(pdf, prepared.instance); assert(JSON.stringify(audit.renderedTextBySlot.companyName) === JSON.stringify((prepared.instance.preparedSlots.companyName as { lines: readonly string[] }).lines), `${template.id} must render prepared name lines unchanged.`); });
  return pdf;
};
const contactA = Buffer.from(renderContactSheet(true).output("arraybuffer")); const contactB = Buffer.from(renderContactSheet(true).output("arraybuffer")); assert(contactA.equals(contactB), "Cover library contact-sheet rendering must be byte-identical.");
const noLogo = renderContactSheet(false); assert(noLogo.getNumberOfPages() === 6, "No-logo variants must render without placeholder pages.");
const contactPath = resolve("artifacts/manual-review/cover-template-library-v1-review.pdf"); mkdirSync(dirname(contactPath), { recursive: true }); writeFileSync(contactPath, contactA);

const projectBytes = readFileSync(resolve("lib/test-fixtures/visual/aurelia-browser-upload.jpg"));
const projectUrl = `data:image/jpeg;base64,${projectBytes.toString("base64")}`;
const services = ["Interior Design", "Space Planning", "Interior Styling", "Material Selection", "Custom Furniture Design", "Project Coordination"];
const aureliaInput = {
  company: { name: "Aurelia Interiors", logoUrl: logo.source, about: "Aurelia Interiors is an interior design studio creating refined residential and commercial spaces with a focus on material quality and functional planning.", activities: services.join(", "), experience: "8" },
  profile: { companyName: "Aurelia Interiors", companyType: "Interior design studio", sections: [
    { id: "about", title: "About Aurelia Interiors", description: "Studio narrative.", content: "Aurelia Interiors creates refined residential and commercial spaces through material quality, functional planning, and contemporary design.", items: [] },
    { id: "services", title: "Interior Design Services", description: "Source-backed interior services.", content: services.join(", "), items: services.map((name) => ({ name, description: `${name} for tailored residential and commercial interiors.` })) },
    { id: "expertise", title: "Residential & Commercial Expertise", description: "Source-backed expertise.", content: "Tailored residential and commercial interiors balance aesthetics, comfort, and practical use.", items: [] },
    { id: "projects", title: "Featured Projects", description: "Source-backed project work.", content: "Riverside Residence.", items: [{ name: "Riverside Residence", description: "Contemporary residential interior." }] },
  ] },
  projects: [{ id: "project:riverside", name: "Riverside Residence", category: "residential", description: "Contemporary residential interior focused on warm materials, natural light, and functional open-plan living.", imageUrl: projectUrl }],
};
const main = async () => {
const first = await routeEditorialInteriorsV1Export(aureliaInput, async () => ({ width: 1600, height: 1200 })); const second = await routeEditorialInteriorsV1Export(aureliaInput, async () => ({ width: 1600, height: 1200 }));
assert(first.mode === "authored" && second.mode === "authored" && first.familyId === "visual-portfolio" && first.packId === "editorial-interiors-v1", "Aurelia must remain authored Visual.");
assert(first.pageOrder[0] === "authored-cover-v1.editorial-warm" && first.pageOrder.length === 5, "Aurelia must select the image-free editorial cover and remain five pages.");
const bytes = Buffer.from(first.pdf.output("arraybuffer")); assert(bytes.equals(Buffer.from(second.pdf.output("arraybuffer"))), "Aurelia repeated render must be byte-identical.");
const raw = bytes.toString("latin1"); assert(!/pexels|image credits/i.test(raw), "Aurelia authored cover must not introduce contextual credits.");
const aureliaPath = resolve("artifacts/manual-review/aurelia-image-free-cover-review.pdf"); writeFileSync(aureliaPath, bytes);
console.log(JSON.stringify({ templates: authoredCoverTemplateDefinitions.map((entry) => entry.id), palettes: authoredCoverPalettes.map((entry) => entry.id), selections: facts.map(({ input }) => ({ company: input.companyName, selection: selectAuthoredCover(input) })), aurelia: { path: aureliaPath, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), pageOrder: first.pageOrder, projectCoverReference: false, projectConsumption: 1, embeddedImages: ["optional company logo", "Riverside project image on project page only"] }, contactSheet: contactPath }, null, 2));
};
main().catch((error) => { console.error(error); process.exitCode = 1; });
