import type { CompanyData } from "./company-data";
import type { PersistedGeneratedProfile, PersistedGeneratedProfileSection } from "./generated-profile-storage";
import { APPLICATION_STORAGE_KEYS, clearApplicationLocalData } from "./local-profile-data";

export type BetaFixtureId = "aurelia" | "northbridge" | "winx" | "aurelia-missing-image" | "aurelia-generated-only" | "legacy-control";
export type BetaExpectedFamily = "visual-portfolio" | "corporate-services" | "product-tech" | "legacy";
export type BetaFixture = {
  id: BetaFixtureId;
  label: string;
  company: CompanyData;
  projects: readonly { id: string; name: string; category?: string; description: string; imageUrl: string }[];
  profileStructure?: { companyData: CompanyData; analysis: { companyType: string; recommendedSections: readonly BetaSelectedSection[] }; selectedSections: readonly BetaSelectedSection[] };
  generatedProfile: PersistedGeneratedProfile;
  expectedFamily: BetaExpectedFamily;
  expectedSafetyOutcome: string;
};
type BetaSelectedSection = { id: string; displayTitle: string; description: string; semanticRole?: string; items?: readonly { id: string; title: string; description: string }[] };
type BetaStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const item = (sectionId: string, kind: string, index: number, name: string, description: string) => ({ id: `${sectionId}:${kind}:${index + 1}`, name, description, sourceEvidence: name });
const selectedItem = (sectionId: string, kind: string, index: number, title: string, description: string) => ({ id: `${sectionId}:${kind}:${index + 1}`, title, description });
const structure = (company: CompanyData, companyType: string, sections: readonly BetaSelectedSection[]) => ({ companyData: company, analysis: { companyType, recommendedSections: sections }, selectedSections: sections });
const profile = (company: CompanyData, companyType: string, sections: PersistedGeneratedProfileSection[], projects: PersistedGeneratedProfile["projects"] = []): PersistedGeneratedProfile => ({
  companyName: company.name, logoUrl: company.logoUrl, companyType, sections,
  about: sections.find((section) => section.id === "about")?.content ?? "", expertise: [], experience: "", projects, reasons: [],
});

const aureliaCompany: CompanyData = {
  name: "Aurelia Interiors", logoUrl: "", companyType: "Interior Design Studio", industry: "Interior Design / Luxury Residential Interiors",
  customerType: "Luxury residential clients", servicesProducts: "Interior Design, Space Planning, Material Selection, Furniture Selection, Lighting Design, Styling, Project Coordination",
  about: "Aurelia Interiors creates refined residential interiors around warm natural materials and calm neutral palettes.", activities: "Interior design, space planning, material selection, furniture selection, lighting design, styling, and project coordination.", experience: "8",
};
const aureliaCapabilities = ["Interior Design", "Space Planning", "Material Selection", "Furniture Selection", "Lighting Design", "Styling", "Project Coordination"];
const riversideDescription = "A contemporary residential interior shaped through warm natural materials, layered lighting, custom furniture, and a calm neutral palette.";
const aureliaSelected: BetaSelectedSection[] = [
  { id: "about", displayTitle: "About Aurelia Interiors", description: "Introduce the studio using supplied information." },
  { id: "services", displayTitle: "Interior Design Capabilities", description: "Present the seven supplied interior design capabilities." },
  { id: "expertise", displayTitle: "Residential Expertise", description: "Describe Aurelia's supplied residential expertise." },
  { id: "approach", displayTitle: "Design Approach", description: "Describe the supplied material-led design approach." },
  { id: "projects", displayTitle: "Selected Projects", description: "Present Riverside Residence using its supplied project record." },
];
const aureliaSections = (imageUrl: string): PersistedGeneratedProfileSection[] => [
  { id: "about", title: aureliaSelected[0].displayTitle, description: aureliaSelected[0].description, content: "Aurelia Interiors is an interior design studio with 8 years of experience creating refined luxury residential interiors.", items: [] },
  { id: "services", title: aureliaSelected[1].displayTitle, description: aureliaSelected[1].description, content: "Seven source-backed interior design capabilities.", items: aureliaCapabilities.map((name, index) => item("services", "service", index, name, `${name} for source-backed residential interiors.`)) },
  { id: "expertise", title: aureliaSelected[2].displayTitle, description: aureliaSelected[2].description, content: "Residential expertise grounded in warm natural materials, functional planning, and calm neutral palettes.", items: [] },
  { id: "approach", title: aureliaSelected[3].displayTitle, description: aureliaSelected[3].description, content: "A calm, material-led approach grounded in the supplied company and project information.", items: [] },
  { id: "projects", semanticRole: "projects", title: aureliaSelected[4].displayTitle, description: aureliaSelected[4].description, content: "Riverside Residence is the supplied completed residential project.", items: [{ id: "projects:project:1", name: "Riverside Residence", description: riversideDescription, imageUrl }] },
];

const northbridgeCompany: CompanyData = {
  name: "Northbridge Advisory", logoUrl: "", companyType: "Business Consulting & Professional Services", industry: "Management Consulting", customerType: "B2B",
  servicesProducts: "Operational Improvement, Strategic Priorities, Management Processes, Growth Advisory, Leadership Collaboration",
  about: "Northbridge Advisory helps growing companies improve operations, clarify strategic priorities, and build effective management processes.", activities: "Consulting with leadership teams to identify operational challenges and structure practical solutions.", experience: "1",
};
const northbridgeServices = ["Operational Improvement", "Strategic Priorities", "Management Processes", "Growth Advisory", "Leadership Collaboration"];
const northbridgeSelected: BetaSelectedSection[] = [
  { id: "about", displayTitle: "About Northbridge Advisory", description: "Introduce the supplied advisory company." },
  { id: "services", semanticRole: "services", displayTitle: "Consulting & Advisory Services", description: "Present the five supplied services.", items: northbridgeServices.map((name, index) => selectedItem("services", "service", index, name, `${name} grounded in supplied advisory information.`)) },
  { id: "howItWorks", displayTitle: "Our Advisory Approach", description: "Explain the supplied leadership collaboration methodology." },
];
const northbridgeSections: PersistedGeneratedProfileSection[] = [
  { id: "about", title: northbridgeSelected[0].displayTitle, description: northbridgeSelected[0].description, content: "With 1 year of experience, Northbridge Advisory helps growing companies improve operations and clarify strategic priorities.", items: [] },
  { id: "services", semanticRole: "services", title: northbridgeSelected[1].displayTitle, description: northbridgeSelected[1].description, content: "Five source-backed consulting and advisory services.", items: northbridgeServices.map((name, index) => item("services", "service", index, name, `${name} grounded in supplied advisory information.`)) },
  { id: "howItWorks", title: northbridgeSelected[2].displayTitle, description: northbridgeSelected[2].description, content: "Northbridge works with leadership teams to identify operational challenges and structure practical solutions.", items: [] },
];

const winxCompany: CompanyData = {
  name: "WinX", logoUrl: "", companyType: "Sales Technology Company", industry: "Sales Technology / Affiliate Marketing", customerType: "B2B SMEs, brands, and growing businesses",
  servicesProducts: "Digital sales platform, campaign management, promoter management, performance tracking, lead generation, and sales growth solutions.",
  about: "WinX is a sales technology platform that helps companies expand sales and market reach through independent promoters called WinXers.", activities: "Sales technology, affiliate marketing, customer acquisition, distributed sales networks, and campaign management.", experience: "3",
};
const winxFeatures = ["Digital Sales Platform", "Affiliate Network", "Campaign Management", "Promoter Management", "Performance Tracking", "Lead Generation", "Sales Growth"];
const winxUseCases = ["SMEs", "Brands", "Growing Businesses"];
const winxSelected: BetaSelectedSection[] = [
  { id: "about", displayTitle: "About WinX", description: "Introduce WinX and its distributed promoter model." },
  { id: "features", displayTitle: "Platform Features", description: "Present the supplied product features.", items: winxFeatures.map((name, index) => selectedItem("features", "feature", index, name, `${name} based on supplied product information.`)) },
  { id: "useCases", displayTitle: "Who WinX Helps", description: "Present the three supplied use cases.", items: winxUseCases.map((name, index) => selectedItem("useCases", "use-case", index, name, `${name} use WinX for supplied sales workflows.`)) },
];
const winxSections: PersistedGeneratedProfileSection[] = [
  { id: "about", title: winxSelected[0].displayTitle, description: winxSelected[0].description, content: "WinX is a Sales Technology Company with 3 years of experience supporting distributed sales and affiliate marketing workflows.", items: [] },
  { id: "features", title: winxSelected[1].displayTitle, description: winxSelected[1].description, content: "Source-backed platform capabilities.", items: winxFeatures.map((name, index) => item("features", "feature", index, name, `${name} based on supplied product information.`)) },
  { id: "useCases", title: winxSelected[2].displayTitle, description: winxSelected[2].description, content: "Source-backed customer use cases.", items: winxUseCases.map((name, index) => item("useCases", "use-case", index, name, `${name} use WinX for supplied sales workflows.`)) },
];

const legacyCompany: CompanyData = { name: "Harbor Collective", logoUrl: "", companyType: "Creative agency", industry: "Creative services", customerType: "Organizations", servicesProducts: "", about: "Harbor Collective is a fictional project-free QA control profile.", activities: "", experience: "" };
const legacySections: PersistedGeneratedProfileSection[] = [
  { id: "about", title: "About Harbor Collective", description: "Project-free source-backed overview.", content: legacyCompany.about, items: [] },
  { id: "team", title: "Team", description: "An intentionally unsupported authored content shape.", content: "A deterministic unsupported section used only to verify the approved project-free legacy route.", items: [] },
];

export const createBetaFixture = (id: BetaFixtureId, validProjectImage: string): BetaFixture => {
  const riverside = (imageUrl: string) => ({ id: "project:beta-riverside", name: "Riverside Residence", category: "Residential Interior", description: riversideDescription, imageUrl });
  if (id === "northbridge") return { id, label: "Northbridge — Corporate / Services", company: northbridgeCompany, projects: [], profileStructure: structure(northbridgeCompany, northbridgeCompany.companyType, northbridgeSelected), generatedProfile: profile(northbridgeCompany, northbridgeCompany.companyType, northbridgeSections), expectedFamily: "corporate-services", expectedSafetyOutcome: "Authored Corporate / Services export expected." };
  if (id === "winx") return { id, label: "WinX — Product / Tech", company: winxCompany, projects: [], profileStructure: structure(winxCompany, winxCompany.companyType, winxSelected), generatedProfile: profile(winxCompany, winxCompany.companyType, winxSections), expectedFamily: "product-tech", expectedSafetyOutcome: "Authored Product / Tech export expected." };
  if (id === "legacy-control") return { id, label: "Project-free approved legacy control", company: legacyCompany, projects: [], generatedProfile: profile(legacyCompany, legacyCompany.companyType, legacySections), expectedFamily: "legacy", expectedSafetyOutcome: "Approved project-free legacy fallback remains available." };
  const imageUrl = id === "aurelia-missing-image" ? "" : validProjectImage;
  const generated = profile(aureliaCompany, aureliaCompany.companyType, aureliaSections(validProjectImage), [riverside(validProjectImage)]);
  return {
    id, label: id === "aurelia" ? "Aurelia — Visual / Portfolio" : id === "aurelia-missing-image" ? "Aurelia — Missing project image" : "Aurelia — Generated-only project evidence",
    company: aureliaCompany, projects: id === "aurelia-generated-only" ? [] : [riverside(imageUrl)], profileStructure: structure(aureliaCompany, aureliaCompany.companyType, aureliaSelected), generatedProfile: generated,
    expectedFamily: "visual-portfolio", expectedSafetyOutcome: id === "aurelia-missing-image" ? "Explicit image failure; legacy/contextual fallback forbidden." : id === "aurelia-generated-only" ? "project_state_generated_only; unsafe fallback blocked." : "Authored Visual / Portfolio export expected.",
  };
};

export const loadBetaFixture = (storage: BetaStorage, fixture: BetaFixture) => {
  clearApplicationLocalData(storage as Storage);
  storage.setItem("companyData", JSON.stringify(fixture.company));
  storage.setItem("projectsData", JSON.stringify(fixture.projects));
  if (fixture.profileStructure) storage.setItem("profileStructure", JSON.stringify(fixture.profileStructure));
  storage.setItem("generatedProfile", JSON.stringify(fixture.generatedProfile));
  return APPLICATION_STORAGE_KEYS.filter((key) => storage.getItem(key) !== null);
};

export const betaFixtureImageState = (projects: readonly { imageUrl?: string }[]): "none" | "valid_data_url" | "missing_or_corrupt" => {
  if (!projects.length) return "none";
  return projects.every((project) => typeof project.imageUrl === "string" && /^data:image\/(?:png|jpeg);base64,/i.test(project.imageUrl)) ? "valid_data_url" : "missing_or_corrupt";
};
