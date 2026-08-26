import { deflateSync } from "node:zlib";
import type { GeneratedProfileInput, PersistedCompanyInput, PersistedProjectInput } from "../enrichment";

export type BetaExpectedShape = "visual-portfolio" | "corporate-services" | "product-tech" | "unsupported";
export type PersistedProductionScenario = {
  id: string;
  expectedShape: BetaExpectedShape;
  acceptableMode: "authored" | "fallback";
  preferredFamily?: Exclude<BetaExpectedShape, "unsupported">;
  companyData: string;
  projectsData: string;
  profile: GeneratedProfileInput;
};

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
const crc32 = (input: Buffer) => {
  let crc = 0xffffffff;
  for (const byte of input) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};
const chunk = (name: string, data: Buffer) => {
  const type = Buffer.from(name, "ascii"); const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4); checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, checksum]);
};
const testUpload = (seed: number) => {
  const width = 18; const height = 24; const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const offset = y * (1 + width * 3) + 1 + x * 3;
    raw[offset] = (x * 11 + seed * 37) % 256; raw[offset + 1] = (y * 17 + seed * 53) % 256; raw[offset + 2] = ((x + y) * 9 + seed * 71) % 256;
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  const png = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", header), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
  return `data:image/png;base64,${png.toString("base64")}`;
};
const serviceItems = (count: number, label = "Capability") => Array.from({ length: count }, (_, index) => ({ name: `${label} ${index + 1}`, description: `Source-backed test description for ${label.toLowerCase()} ${index + 1}.` }));
const company = (name: string): PersistedCompanyInput => ({ name, about: "Source-backed test company narrative.", activities: "Source-backed test operating activities.", experience: "Source-backed test experience statement." });
const profile = (name: string, companyType: string, itemRole: "services" | "features", count: number, useCases = 0): GeneratedProfileInput => ({ companyName: name, companyType, sections: [
  { id: "about", title: "Company overview", description: "Source-backed positioning statement.", content: "This production-shaped test narrative describes the company using only supplied source content and remains within the authored envelope.", items: [] },
  { id: itemRole, title: itemRole === "features" ? "Product features" : "Services and capabilities", description: "Source-backed introduction.", content: "Source-backed section content.", items: serviceItems(count, itemRole === "features" ? "Feature" : "Service") },
  ...(useCases ? [{ id: "useCases", title: "Use cases", description: "Source-backed applications.", content: "Source-backed use-case content.", items: serviceItems(useCases, "Use case") }] : []),
] });
const scenario = (id: string, expectedShape: BetaExpectedShape, companyInput: PersistedCompanyInput, generated: GeneratedProfileInput, projects: readonly PersistedProjectInput[], acceptableMode: "authored" | "fallback", preferredFamily?: Exclude<BetaExpectedShape, "unsupported">): PersistedProductionScenario => ({ id, expectedShape, acceptableMode, preferredFamily, companyData: JSON.stringify(companyInput), projectsData: JSON.stringify(projects), profile: generated });
const visual = (id: string, name: string, count: number) => {
  const projects = Array.from({ length: count }, (_, index) => ({ id: `${id}-project-${index + 1}`, name: `${name} Project ${index + 1}`, category: "Test portfolio", description: `Source-backed project description ${index + 1}.`, imageUrl: testUpload(index + 1) }));
  const generated = profile(name, "Interior design studio", "services", 4);
  generated.sections = [...generated.sections, { id: "projects", title: "Selected projects", description: "Source-backed portfolio.", content: "Source-backed portfolio content.", items: projects.map(({ name: projectName, description }) => ({ name: projectName, description })) }];
  return scenario(id, "visual-portfolio", company(name), generated, projects, "authored", "visual-portfolio");
};
const corporate = (id: string, name: string, companyType: string, count: number) => scenario(id, "corporate-services", company(name), profile(name, companyType, "services", count), [], "authored", "corporate-services");
const product = (id: string, name: string, companyType: string, count: number, useCases = 0) => scenario(id, "product-tech", company(name), profile(name, companyType, "features", count, useCases), [], "authored", "product-tech");

const unknown = profile("Boundary Holdings", "Diversified business", "services", 2); unknown.sections = [...unknown.sections, { id: "team", title: "Team", description: "", content: "Required unsupported team content.", items: [] }];
const projectProduct = profile("Project Product", "SaaS platform", "features", 3); const projectProductItems = [{ id: "required-project", name: "Required project", description: "Required project source.", imageUrl: testUpload(9) }];
const missingImage = visual("edge-missing-image", "Incomplete Portfolio", 2); const parsedMissing = JSON.parse(missingImage.projectsData) as PersistedProjectInput[]; parsedMissing[1].imageUrl = "";

export const REAL_USER_BETA_SCENARIOS: readonly PersistedProductionScenario[] = [
  visual("visual-one-project", "Aurelia Interiors", 1), visual("visual-two-projects", "Northline Architecture", 2), visual("visual-five-projects", "Form Spatial Studio", 5),
  corporate("corporate-sparse", "Axiom Advisory", "Management consulting", 1), corporate("corporate-normal", "Meridian Operations", "Business services", 5), corporate("corporate-dense", "Civic Engineering", "Engineering consulting", 8),
  product("product-sparse", "Nodal", "SaaS platform", 1), product("product-normal", "Relay Systems", "Automation software", 6, 3), product("product-dense", "Vector Cloud", "AI software platform", 10, 5),
  scenario("edge-unknown-section", "unsupported", company("Boundary Holdings"), unknown, [], "fallback"),
  scenario("edge-project-bearing-product", "unsupported", company("Project Product"), projectProduct, projectProductItems, "fallback"),
  { ...missingImage, id: "edge-incomplete-image-coverage", expectedShape: "unsupported", acceptableMode: "fallback", preferredFamily: undefined, projectsData: JSON.stringify(parsedMissing) },
] as const;
