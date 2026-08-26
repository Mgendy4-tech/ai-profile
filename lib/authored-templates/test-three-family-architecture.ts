import { createContentShape, normalizeAuthoredContentUnits } from "./content-shape";
import { validateDocumentCoverage } from "./coverage";
import type { ProductionEnrichmentInput } from "./enrichment";
import { routeEditorialInteriorsV1Export } from "./export-orchestrator";
import { rankAuthoredTemplateFamilies } from "./family-ranking";
import { createProductTechDocumentPlan } from "./product-tech-planner";
import { authoredTemplateFamilies, authoredTemplatePacks } from "./registry";
import { normalizeProductionSectionRoles } from "./section-role-normalization";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const item = (index: number) => ({ name: `Source item ${index + 1}`, description: "Source-backed test description." });
const base = (companyType: string, sectionId: string, count: number): ProductionEnrichmentInput => ({ company: { name: "Architecture Gate Fixture", about: "Source-backed test narrative.", activities: "Source-backed activities.", experience: "Source-backed experience." }, profile: { companyName: "Architecture Gate Fixture", companyType, sections: [{ id: "about", title: "Overview", description: "Source-backed positioning.", content: "Source-backed narrative for deterministic architecture validation.", items: [] }, { id: sectionId, title: "Capabilities", description: "Source-backed capability introduction.", content: "Source-backed capability content.", items: Array.from({ length: count }, (_, index) => item(index)) }] }, projects: [] });

const run = async () => {
  const corporate = base("Professional consulting services", "services", 5);
  const product = base("SaaS software platform", "services", 5);
  const portfolio = base("Interior design studio", "services", 4); portfolio.company.name = "Aurelia Studio"; portfolio.projects = [{ id: "project:1", name: "Source Project", description: "Source-backed project description.", imageUrl: PNG }]; portfolio.profile.sections = [...portfolio.profile.sections, { id: "projects", title: "Projects", description: "Source-backed projects.", content: "Source-backed portfolio.", items: [{ name: "Source Project", description: "Source-backed project description." }] }];
  const decisions = await Promise.all([routeEditorialInteriorsV1Export(corporate), routeEditorialInteriorsV1Export(product), routeEditorialInteriorsV1Export(portfolio, async () => ({ width: 1054, height: 1492 }))]);
  assert(decisions[0].mode === "authored" && decisions[0].familyId === "corporate-services", "Service-heavy input must select Corporate.");
  assert(decisions[1].mode === "authored" && decisions[1].familyId === "product-tech", "Product-led input must select Product / Tech.");
  assert(decisions[2].mode === "authored" && decisions[2].familyId === "visual-portfolio", `Authentic project-heavy input must select Visual: ${JSON.stringify(decisions[2])}`);

  const projectBearingCorporate = base("Professional consulting services", "services", 4); projectBearingCorporate.projects = [{ id: "project:1", name: "Required Project", description: "Required source project.", imageUrl: "" }];
  const projectBearingProduct = base("SaaS software platform", "features", 4); projectBearingProduct.projects = [{ id: "project:1", name: "Required Project", description: "Required source project.", imageUrl: "" }];
  const missingVisual = structuredClone(portfolio); missingVisual.projects[0].imageUrl = "";
  for (const [label, input] of [["project-bearing Corporate", projectBearingCorporate], ["project-bearing Product", projectBearingProduct], ["missing authentic Visual image", missingVisual]] as const) { const decision = await routeEditorialInteriorsV1Export(input); assert(decision.mode === "fallback" && decision.pdf === null, `${label} must fall back atomically.`); }
  const unknown = base("Professional consulting services", "services", 2); unknown.profile.sections = [...unknown.profile.sections, { id: "team", title: "Team", description: "", content: "Required unsupported content.", items: [] }]; assert((await routeEditorialInteriorsV1Export(unknown)).mode === "fallback", "Unknown required section must fall back.");
  const ambiguous = base("Professional consulting services", "about-services", 2); assert((await routeEditorialInteriorsV1Export(ambiguous)).mode === "fallback", "Ambiguous section role must fall back.");

  const servicesSection = corporate.profile.sections[1]; const normalRoles = normalizeProductionSectionRoles([servicesSection]); const productRoles = normalizeProductionSectionRoles([servicesSection], { productTech: true });
  assert(normalRoles.sections[0]?.role === "services" && productRoles.sections[0]?.role === "features", "Services-to-features reinterpretation must be explicit and product-scoped.");
  assert(normalizeProductionSectionRoles(product.profile.sections, { productTech: true }).sections.map((entry) => entry.section.id).join("|") === product.profile.sections.map((section) => section.id).join("|"), "Normalization must preserve source section ordering.");
  const ambiguousNormalization = normalizeProductionSectionRoles([{ ...servicesSection, id: "about-services" }, { ...servicesSection, id: "unknown" }]); assert(ambiguousNormalization.sections.length + ambiguousNormalization.diagnostics.length === 2, "Every production section must become a normalized role or an explicit diagnostic.");

  const productUnits = normalizeAuthoredContentUnits({ company: {}, sections: [{ id: "about", role: "narrative", content: "Product narrative." }, { id: "features", role: "features", items: Array.from({ length: 4 }, (_, index) => ({ id: `feature:${index}` })) }, { id: "useCases", role: "use_cases", items: Array.from({ length: 6 }, (_, index) => ({ id: `use-case:${index}` })) }], projects: [] });
  const productShape = createContentShape(productUnits, null, true); const ranking = rankAuthoredTemplateFamilies(authoredTemplateFamilies, productShape); assert(JSON.stringify(ranking) === JSON.stringify(rankAuthoredTemplateFamilies([...authoredTemplateFamilies].reverse(), productShape)), "Three-family ranking must be independent of registry order.");
  assert(Object.keys(productShape.facts).every((key) => !["x", "y", "width", "height", "columns", "fontSize", "geometry", "cropRatio"].includes(key)), "ContentShape must contain no template geometry.");

  for (const remaining of [1, 2, 3] as const) {
    const useCases = Array.from({ length: 3 + remaining }, (_, index) => ({ contentId: `use-case:${index}`, index: String(index + 1).padStart(2, "0"), title: `Use case ${index + 1}`, description: "Source-backed use-case description." }));
    const units = normalizeAuthoredContentUnits({ company: {}, sections: [{ id: "about", role: "narrative", content: "Product narrative." }, { id: "features", role: "features", items: [{ id: "feature:0" }] }, { id: "useCases", role: "use_cases", items: useCases.map((entry) => ({ id: entry.contentId })) }], projects: [] });
    const plan = createProductTechDocumentPlan({ units, cover: { contentId: "company", documentLabel: "PRODUCT PROFILE", companyName: "Test Product", companyType: "SaaS platform" }, overview: { contentId: "about", title: "Overview", body: "Product narrative.", supportingLine: "Source-backed positioning." }, featuresHeading: "Features", featuresSupportingLine: "Source-backed features.", features: [{ contentId: "feature:0", index: "01", title: "Feature", description: "Source-backed feature." }], useCases: { heading: "Use cases", supportingLine: "Source-backed use cases.", items: useCases } });
    assert(plan.compatible, `${remaining}-item use-case continuation must plan.`); if (!plan.compatible) continue; const terminal = plan.plan.pages.at(-1)!; assert(terminal.templateId === `product-tech-v1.use-cases-continuation-${remaining}`, `${remaining}-item use-case continuation must select its exact fixed template.`); assert(validateDocumentCoverage(units, plan.plan).complete, `${remaining}-item use-case continuation must preserve complete exact-once coverage.`);
  }

  authoredTemplatePacks.forEach((pack) => pack.templates.forEach((template) => {
    assert(template.envelope.slots.length > 0, `${template.id} must expose an explicit envelope.`);
    template.envelope.slots.forEach((slot) => {
      assert(Boolean(slot.id && slot.path) && typeof slot.required === "boolean", `${template.id}.${slot.id} must expose a stable path and required policy.`);
      if (slot.kind === "text") assert(slot.fontSize > 0 && slot.widthMm > 0 && slot.maxLines > 0, `${template.id}.${slot.id} must have fixed text capacity.`);
      if (slot.kind === "collection") assert(slot.minItems >= 0 && slot.maxItems >= slot.minItems, `${template.id}.${slot.id} must have fixed collection capacity.`);
    });
  }));
  console.log("Three-family architecture validation gate tests passed.");
};
run().catch((error) => { console.error(error); process.exitCode = 1; });
