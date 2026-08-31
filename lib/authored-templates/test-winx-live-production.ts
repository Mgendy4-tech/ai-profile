import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { companySemanticText, companySourceMaterial, type CompanyData } from "../company-data";
import { validateGeneratedProfileSections, type GeneratedProfileSection, type SelectedProfileSection } from "../generated-profile-boundary";
import { approvedSectionManifest, semanticCoverageContract } from "../generated-profile-prompt-contract";
import { createProfileGenerationModelPayload, createStructureAnalysisModelPayload } from "../production-limits";
import { createContentShape, normalizeAuthoredContentUnits } from "./content-shape";
import { routeEditorialInteriorsV1Export } from "./export-orchestrator";
import { explainAuthoredTemplateFamilyRanking } from "./family-ranking";
import { authoredTemplateFamilies } from "./registry";
import { normalizeProductionSectionRoles } from "./section-role-normalization";

const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => { if (!condition) throw new Error(message); };
const logoUrl = `data:image/png;base64,${readFileSync(resolve("lib/test-fixtures/logos/brand-square-transparent.png")).toString("base64")}`;
const company: CompanyData = {
  name: "WinX", logoUrl, companyType: "Sales Technology Company", industry: "Sales Technology / Affiliate Marketing",
  customerType: "B2B — SMEs, brands, and growing businesses",
  about: "WinX is a sales technology platform designed to help companies expand their sales, market reach, and customer acquisition through a distributed network of independent promoters called WinXers.",
  servicesProducts: "Digital sales platform, affiliate sales network, campaign management, promoter management, performance tracking, lead generation, and sales growth solutions.",
  activities: "Sales technology, affiliate marketing, customer acquisition, distributed sales networks, campaign management, and business growth.", experience: "3",
};
const selected: SelectedProfileSection[] = [
  { id: "about", displayTitle: "About WinX", description: "Introduce WinX and its distributed promoter model." },
  { id: "features", displayTitle: "Platform Capabilities", description: "Present campaign, promoter, performance tracking, lead generation, customer acquisition, and sales growth capabilities." },
  { id: "useCases", displayTitle: "Who WinX Helps", description: "Show how SMEs, brands, and growing businesses use WinX to expand sales and market reach." },
];
const items = {
  features: [
    ["Digital Sales Platform", "The Digital sales platform provides the technology foundation for coordinating sales activity and supporting market expansion.", "Digital sales platform"],
    ["Affiliate Sales Network", "An affiliate sales network connects business campaigns with WinXers operating as independent promoters.", "affiliate sales network"],
    ["Campaign Management", "Campaign management supports the organization and coordination of sales and affiliate marketing campaigns.", "campaign management"],
    ["Promoter Management", "Promoter management helps businesses coordinate the independent promoters participating in their distributed sales networks.", "promoter management"],
    ["Performance Tracking", "Performance tracking provides visibility into sales and promoter activity associated with campaigns.", "performance tracking"],
    ["Lead Generation", "Lead generation capabilities support customer acquisition by helping businesses extend their reach through independent promoters.", "lead generation"],
    ["Sales Growth Solutions", "The platform provides sales growth solutions designed to support business growth, customer acquisition, and wider market reach.", "sales growth solutions"],
  ],
  useCases: [
    ["SMEs", "SMEs can use WinX to extend sales activity, manage promoter-led campaigns, generate leads, and support customer acquisition.", "SMEs"],
    ["Brands", "WinX helps brands expand market reach through affiliate marketing campaigns and a distributed network of independent promoters.", "brands"],
    ["Growing Businesses", "For growing businesses, WinX provides campaign, promoter, and performance management capabilities that support sales and business growth.", "growing businesses"],
  ],
} as const;
const generated: GeneratedProfileSection[] = [
  { id: "about", title: "About WinX", description: selected[0].description, content: "WinX is a Sales Technology Company operating in the sales technology and affiliate marketing industry. With 3 years of experience, the company provides a digital platform that helps businesses expand sales, market reach, and customer acquisition through a distributed network of independent promoters known as WinXers. Its activities span sales technology, affiliate marketing, distributed sales networks, campaign management, customer acquisition, and business growth.", items: [] },
  { id: "features", title: "Platform Capabilities", description: selected[1].description, content: "The WinX platform brings together the technology and network capabilities required to manage distributed sales activity, engage independent promoters, track performance, generate leads, support customer acquisition, and drive sales growth.", items: items.features.map(([name, description, sourceEvidence], index) => ({ id: `features:feature:${index + 1}`, name, description, sourceEvidence })) },
  { id: "useCases", title: "Who WinX Helps", description: selected[2].description, content: "WinX serves B2B customers seeking to expand sales and market reach through sales technology, affiliate marketing, and a distributed network of independent promoters.", items: items.useCases.map(([name, description, sourceEvidence], index) => ({ id: `useCases:use-case:${index + 1}`, name, description, sourceEvidence })) },
];

const main = async () => {
  const projectedAnalysis = createStructureAnalysisModelPayload({ company, projects: [] });
  const projectedGeneration = createProfileGenerationModelPayload({ company, projects: [], selectedSections: selected });
  const projected = JSON.stringify({ projectedAnalysis, projectedGeneration });
  for (const field of ["companyType", "industry", "customerType", "servicesProducts", "activities", "experience"] as const) assert(projectedAnalysis.company[field] === company[field] && projectedGeneration.company[field] === company[field], `${field} did not reach both model-safe payloads.`);
  assert(!projected.includes("base64") && !("logoUrl" in projectedAnalysis.company), "Logo bytes entered a text-model payload.");
  assert(approvedSectionManifest(selected).includes('id="useCases" title="Who WinX Helps"'), "Approved manifest lost exact use-case identity.");
  assert(semanticCoverageContract(company).includes('"3 years of experience"'), "Experience coverage instruction is missing.");

  const oldSourceMaterial = [company.about, company.activities, company.experience];
  const capturedFailure = structuredClone(generated);
  capturedFailure[0].content = capturedFailure[0].content.replace("With 3 years of experience, ", "");
  const oldBoundary = validateGeneratedProfileSections(selected, capturedFailure, { productTech: true, productSourceMaterial: oldSourceMaterial });
  assert(!oldBoundary.valid, "The deployed source-material gap must reproduce.");
  assert(!oldBoundary.diagnostics.some((diagnostic) => diagnostic.code === "generated_section_missing_id" || diagnostic.code === "generated_section_title_mismatch"), "The deployed failure was incorrectly classified as a missing/mismatched section.");
  assert(oldBoundary.diagnostics.some((diagnostic) => diagnostic.code === "generated_product_item_evidence_unsupported" && diagnostic.sectionId === "features"), "The deployed feature evidence rejection did not reproduce.");

  const boundary = validateGeneratedProfileSections(selected, generated, { productTech: true, productSourceMaterial: companySourceMaterial(company), experienceYears: company.experience });
  assert(boundary.valid, `Corrected WinX boundary failed: ${JSON.stringify(boundary.diagnostics)}`);
  assert(boundary.sections.map((section) => section.id).join("|") === "about|features|useCases", "Approved sections were omitted, duplicated, or reordered.");
  assert(boundary.sections.some((section) => section.content.includes("3 years of experience")), "Experience evidence disappeared from generated content.");
  const normalized = normalizeProductionSectionRoles(boundary.sections, { productTech: true });
  assert(normalized.diagnostics.length === 0 && normalized.sections.map((entry) => entry.role).join("|") === "narrative|features|use_cases", "WinX semantic normalization failed.");
  const units = normalizeAuthoredContentUnits({ company: {}, sections: [
    { id: "about", role: "narrative", content: boundary.sections[0].content },
    { id: "features", role: "features", items: boundary.sections[1].items.map((_, index) => ({ id: `features:item:${index}` })) },
    { id: "useCases", role: "use_cases", items: boundary.sections[2].items.map((_, index) => ({ id: `useCases:item:${index}` })) },
  ], projects: [] });
  const ranking = explainAuthoredTemplateFamilyRanking(authoredTemplateFamilies, createContentShape(units, null, true));
  const product = ranking.evaluations.find((entry) => entry.familyId === "product-tech"); const corporate = ranking.evaluations.find((entry) => entry.familyId === "corporate-services");
  assert(product?.score === 8 && corporate?.score === 1 && ranking.selectedFamilyId === "product-tech", `Unexpected WinX ranking: ${JSON.stringify(ranking)}`);
  const decision = await routeEditorialInteriorsV1Export({ company, profile: { companyName: company.name, companyType: "Sales Technology Company", sections: boundary.sections }, projects: [] }, async () => ({ width: 640, height: 640 }));
  assert(decision.mode === "authored" && decision.familyId === "product-tech" && decision.packId === "product-tech-v1", `WinX authored routing failed: ${JSON.stringify(decision.reasons)}`);
  assert(decision.pageOrder[0] === "authored-cover-v1.dynamic-bold", "WinX must select the deterministic technical cover.");
  assert(decision.pageOrder[3] === "product-tech-v1.features-continuation-3", "The real export path must select the fixed three-item feature continuation.");
  const rawPages = (decision.pdf.internal as unknown as { pages: string[][] }).pages;
  const page3 = rawPages[3].join("\n"); const page4 = rawPages[4].join("\n");
  assert(page3.includes("Platform Capabilities") && page3.includes("Present campaign, promoter"), "Page 3 must own the full feature introduction.");
  assert(page4.includes("FEATURES / CONTINUED") && page4.includes("MORE CAPABILITIES"), "Page 4 must use the authored compact continuation treatment.");
  assert(!page4.includes("Platform Capabilities") && !page4.includes("Present campaign, promoter"), "Page 4 must not repeat the feature title or description.");
  const pdf = Buffer.from(decision.pdf.output("arraybuffer")).toString("latin1"); assert(!/pexels|image credits/i.test(pdf), "WinX unexpectedly reached legacy image rendering.");
  const reviewPath = resolve("artifacts/manual-review/product-tech-v1-winx-real-ui-continuation-fix.pdf");
  mkdirSync(resolve("artifacts/manual-review"), { recursive: true });
  writeFileSync(reviewPath, Buffer.from(decision.pdf.output("arraybuffer")));
  console.log(JSON.stringify({ ids: boundary.sections.map((section) => section.id), normalization: normalized.sections.map((entry) => ({ id: entry.section.id, role: entry.role })), ranking: { corporate: corporate?.score, productTech: product?.score, selected: ranking.selectedFamilyId }, decision: { mode: decision.mode, familyId: decision.familyId, packId: decision.packId, pageOrder: decision.pageOrder }, reviewPath }));
};

main().catch((error) => { console.error(error); process.exitCode = 1; });
