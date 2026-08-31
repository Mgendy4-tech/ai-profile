import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { routeEditorialInteriorsV1Export } from "./export-orchestrator";
import type { ProductionEnrichmentInput } from "./enrichment";
import { classifyAuthoredLogoShape, containImageInFrame } from "./packs/logo";
import { corporateServicesCoverTemplate } from "./packs/corporate-services-v1/cover";
import { editorialInteriorsCoverTemplate } from "./packs/editorial-interiors-v1/cover";
import { productTechCoverTemplate } from "./packs/product-tech-v1/cover";
import type { ImageSlotValue } from "./types";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const logoDirectory = resolve("lib", "test-fixtures", "logos");
const fixture = (name: string, width: number, height: number) => {
  const bytes = readFileSync(resolve(logoDirectory, name));
  const format = extname(name).toLowerCase() === ".jpg" ? "JPEG" : "PNG";
  return { source: `data:image/${format === "JPEG" ? "jpeg" : "png"};base64,${bytes.toString("base64")}`, format, width, height } as const;
};
const square = fixture("brand-square-transparent.png", 240, 240);
const wide = fixture("brand-wide-transparent.png", 480, 160);
const tall = fixture("brand-tall-transparent.png", 160, 480);
const jpeg = fixture("brand-wide.jpg", 480, 160);
const heroBytes = readFileSync(resolve("lib", "test-fixtures", "visual", "aurelia-user-upload.png"));
const hero = { source: `data:image/png;base64,${heroBytes.toString("base64")}`, width: heroBytes.readUInt32BE(16), height: heroBytes.readUInt32BE(20) };
const dimensions = new Map([[square.source, square], [wide.source, wide], [tall.source, tall], [jpeg.source, jpeg], [hero.source, hero]]);
const decode = async (source: string) => {
  const value = dimensions.get(source);
  if (!value) throw new Error("Test decoder rejected malformed image data.");
  return { width: value.width, height: value.height };
};
const logoValue = (value: typeof square | typeof wide | typeof tall | typeof jpeg): ImageSlotValue => ({ role: "company_logo", provenance: "user_upload", format: value.format, width: value.width, height: value.height, source: value.source });

const corporate = (logoUrl?: string): ProductionEnrichmentInput => ({
  company: { name: "Northbridge Advisory", logoUrl, about: "Northbridge Advisory helps growing companies improve operations.", activities: "Operations consulting and strategic planning.", experience: "Source-backed advisory experience." },
  profile: { companyName: "Northbridge Advisory", companyType: "Business consulting and advisory services", sections: [
    { id: "about", title: "About Northbridge Advisory", description: "Practical advisory for growing businesses.", content: "Northbridge Advisory helps growing companies improve operations, clarify strategic priorities, and build effective management processes.", items: [] },
    { id: "services", title: "Consulting & Advisory Services", description: "Source-backed capabilities.", content: "Operations consulting and strategic planning.", items: [
      { name: "Operational Advisory", description: "Operational advisory grounded in supplied company information." },
      { name: "Strategic Planning", description: "Strategic planning grounded in supplied company information." },
    ] },
  ] }, projects: [],
});
const product = (logoUrl?: string): ProductionEnrichmentInput => ({
  company: { name: "Nodi", logoUrl, about: "Nodi is a software platform for organized operational workflows.", activities: "Workflow organization and process centralization.", experience: "Source-backed platform information." },
  profile: { companyName: "Nodi", companyType: "B2B SaaS platform", sections: [
    { id: "about", title: "About Nodi", description: "A focused operational platform.", content: "Nodi is a software platform for organized operational workflows.", items: [] },
    { id: "features", title: "Platform Capabilities", description: "Source-backed product capabilities.", content: "Workflow organization and process centralization.", items: [
      { name: "Workflow Organization", description: "Organizes operational workflows from supplied product information." },
      { name: "Process Centralization", description: "Centralizes recurring processes from supplied product information." },
    ] },
  ] }, projects: [],
});
const visual = (logoUrl?: string): ProductionEnrichmentInput => ({
  company: { name: "Aurelia Interior Studio", logoUrl, about: "A source-backed interior studio narrative.", activities: "Interior design services.", experience: "Source-backed studio experience." },
  profile: { companyName: "Aurelia Interior Studio", companyType: "Interior design studio", sections: [
    { id: "about", title: "About Aurelia", description: "Source-backed studio introduction.", content: "Aurelia creates considered interior environments using source-backed project information.", items: [] },
    { id: "services", title: "Capabilities", description: "Source-backed capabilities.", content: "Interior design services.", items: [1, 2, 3, 4].map((number) => ({ name: `Capability ${number}`, description: `Source-backed capability ${number}.` })) },
    { id: "projects", title: "Projects", description: "Source-backed work.", content: "Selected work.", items: [{ name: "Aurelia Residence", description: "Source-backed residential project." }] },
  ] }, projects: [{ id: "project-1", name: "Aurelia Residence", description: "Source-backed residential project.", imageUrl: hero.source }],
});

const bytes = (decision: Awaited<ReturnType<typeof routeEditorialInteriorsV1Export>>) => {
  if (decision.mode !== "authored") throw new Error(`Expected authored output: ${JSON.stringify(decision.reasons)}`);
  return Buffer.from(decision.pdf.output("arraybuffer"));
};
const save = (path: string, content: Buffer) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, content); };

const run = async () => {
  for (const template of [editorialInteriorsCoverTemplate, corporateServicesCoverTemplate, productTechCoverTemplate]) {
    const logoSlot = template.envelope.slots.find((slot) => slot.id === "logo");
    assert(logoSlot?.kind === "image" && !logoSlot.required && logoSlot.allowedRoles.join() === "company_logo" && logoSlot.allowedProvenances.join() === "user_upload", `${template.id} must expose the same optional user-upload logo contract.`);
  }
  for (const candidate of [square, wide, tall, jpeg]) {
    const prepared = corporateServicesCoverTemplate.prepare({ contentId: "company", documentLabel: "COMPANY PROFILE", companyName: "Northbridge Advisory", companyType: "Business advisory", logo: logoValue(candidate) });
    assert(prepared.compatible, `${candidate.format} ${candidate.width}x${candidate.height} logo must pass cover preflight.`);
    const placement = containImageInFrame({ x: 10, y: 20, width: 40, height: 20 }, candidate.width / candidate.height);
    assert(placement.x >= 10 && placement.y >= 20 && placement.x + placement.width <= 50.0001 && placement.y + placement.height <= 40.0001, "Contain placement must stay inside the fixed frame.");
    assert(Math.abs(placement.width / placement.height - candidate.width / candidate.height) < 0.0001, "Contain placement must preserve aspect ratio.");
    const expectedShape = candidate.width / candidate.height >= 1.8 ? "wide" : candidate.width / candidate.height <= 0.72 ? "tall" : "balanced";
    assert(classifyAuthoredLogoShape(candidate.width / candidate.height) === expectedShape, "Logo shape classification must be deterministic.");
  }
  const wrongProvenance = corporateServicesCoverTemplate.prepare({ contentId: "company", documentLabel: "COMPANY PROFILE", companyName: "Northbridge Advisory", companyType: "Business advisory", logo: { ...logoValue(square), provenance: "pexels" } });
  assert(!wrongProvenance.compatible && wrongProvenance.issues.some((issue) => issue.code === "image_provenance_not_allowed"), "Contextual provenance must never enter a company-logo slot.");

  const noLogoFirst = await routeEditorialInteriorsV1Export(corporate(), decode);
  const noLogoSecond = await routeEditorialInteriorsV1Export(corporate(), decode);
  assert(noLogoFirst.mode === "authored" && noLogoFirst.familyId === "corporate-services" && bytes(noLogoFirst).equals(bytes(noLogoSecond)), "No-logo Corporate output must remain authored and byte deterministic.");

  const cases = [
    ["visual-portfolio", visual(square.source)],
    ["corporate-services", corporate(wide.source)],
    ["product-tech", product(jpeg.source)],
  ] as const;
  const rendered = new Map<string, Buffer>();
  for (const [familyId, input] of cases) {
    const without = await routeEditorialInteriorsV1Export({ ...input, company: { ...input.company, logoUrl: undefined } }, decode);
    const withLogo = await routeEditorialInteriorsV1Export(input, decode);
    assert(without.mode === "authored" && withLogo.mode === "authored" && without.familyId === familyId && withLogo.familyId === familyId, `${familyId} selection must remain unchanged by a logo.`);
    if (without.mode !== "authored" || withLogo.mode !== "authored") throw new Error("Expected authored family decisions.");
    assert(without.pdf.getNumberOfPages() === withLogo.pdf.getNumberOfPages(), `${familyId} logo support must not change page count.`);
    assert((withLogo.pdf.output() as string).includes("/Subtype /Image"), `${familyId} PDF must embed the prepared logo raster.`);
    rendered.set(familyId, bytes(withLogo));
  }

  const malformed = await routeEditorialInteriorsV1Export(corporate("data:image/png;base64,malformed"), decode);
  assert(malformed.mode === "fallback" && malformed.reasons.some((reason) => reason.stage === "enrichment" && reason.path === "company.logoUrl"), "Malformed PNG data must fail logo enrichment explicitly.");
  const invalidFormat = await routeEditorialInteriorsV1Export(corporate("data:image/gif;base64,AAAA"), decode);
  assert(invalidFormat.mode === "fallback" && invalidFormat.reasons.some((reason) => reason.stage === "operational" && reason.code === "image_format_limit" && reason.path === "company.logoUrl"), "Unsupported logo formats must fail the operational boundary.");
  const oversized = await routeEditorialInteriorsV1Export(corporate(`data:image/png;base64,${"A".repeat(4_300_000)}`), decode);
  assert(oversized.mode === "fallback" && oversized.reasons.some((reason) => reason.stage === "operational" && reason.code === "image_byte_limit" && reason.path === "company.logoUrl"), "Oversized logos must fail the existing per-image byte limit.");

  const paths = {
    visual: resolve("artifacts", "manual-review", "visual-portfolio-v1-logo-review.pdf"),
    corporate: resolve("artifacts", "manual-review", "corporate-services-v1-northbridge-logo-review.pdf"),
    product: resolve("artifacts", "manual-review", "product-tech-v1-nodi-logo-review.pdf"),
    corporateNoLogo: resolve("artifacts", "manual-review", "corporate-services-v1-northbridge-no-logo-review.pdf"),
  };
  save(paths.visual, rendered.get("visual-portfolio")!);
  save(paths.corporate, rendered.get("corporate-services")!);
  save(paths.product, rendered.get("product-tech")!);
  save(paths.corporateNoLogo, bytes(noLogoFirst));
  console.log(`Three-family optional logo tests passed. Reviews: ${Object.values(paths).join(", ")}`);
};

run().catch((error) => { console.error(error); process.exitCode = 1; });
