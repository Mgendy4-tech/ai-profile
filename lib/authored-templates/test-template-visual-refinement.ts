import { jsPDF } from "jspdf";
import { editorialInteriorsClosingTemplate } from "./packs/editorial-interiors-v1/closing";
import { editorialInteriorsProjectTextGeometry } from "./packs/editorial-interiors-v1/portfolio-project-pages";
import { editorialInteriorsV1VisualSystem } from "./packs/editorial-interiors-v1/visual-system";
import { corporateServicesClosingTemplate } from "./packs/corporate-services-v1/closing";
import { CORPORATE_SERVICES_TEXT_GEOMETRY, CORPORATE_SINGLE_CONTINUATION_GEOMETRY, corporateServicesContinuationTemplates } from "./packs/corporate-services-v1/services";
import { corporateServicesNarrativeAlternateTemplate, corporateServicesNarrativeSparseTemplate } from "./packs/corporate-services-v1/narrative";
import type { CorporateNarrativeContent, CorporateServicesPageContent } from "./packs/corporate-services-v1/content";
import { corporateServicesV1VisualSystem } from "./packs/corporate-services-v1/visual-system";
import { PRODUCT_FEATURE_CONTINUATION_GEOMETRY, productFeatureContinuationTemplates } from "./packs/product-tech-v1/features";
import type { ProductFeaturesPageContent } from "./packs/product-tech-v1/content";
import { productTechClosingTemplate } from "./packs/product-tech-v1/closing";
import { productTechV1VisualSystem } from "./packs/product-tech-v1/visual-system";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };

const page = { width: 210, height: 297 } as const;
const assertFrame = (name: string, frame: { x: number; y: number; width: number; height: number }) => {
  assert(frame.x >= 0 && frame.y >= 0 && frame.x + frame.width <= page.width && frame.y + frame.height <= page.height, `${name} must remain inside the A4 frame.`);
};
const assertTextFrame = (name: string, frame: { x: number; y: number; width: number }) => {
  assert(frame.x >= 0 && frame.y >= 0 && frame.x + frame.width <= page.width, `${name} text frame must remain inside A4.`);
};

assert(editorialInteriorsV1VisualSystem.page.width === page.width && editorialInteriorsV1VisualSystem.page.height === page.height, "Visual / Portfolio must remain A4.");
assert(corporateServicesV1VisualSystem.page.width === page.width && corporateServicesV1VisualSystem.page.height === page.height, "Corporate / Services must remain A4.");
assert(productTechV1VisualSystem.page.width === page.width && productTechV1VisualSystem.page.height === page.height, "Product / Tech must remain A4.");

assert(editorialInteriorsV1VisualSystem.layout.margin === 19 && editorialInteriorsV1VisualSystem.layout.right === 191, "Visual / Portfolio must keep the bounded editorial text frame.");
assert(corporateServicesV1VisualSystem.layout.margin === 19 && corporateServicesV1VisualSystem.layout.right === 191, "Corporate / Services must keep the bounded service frame.");
assert(productTechV1VisualSystem.layout.margin === 19 && productTechV1VisualSystem.layout.right === 191, "Product / Tech must keep the bounded product frame.");
assertFrame("Visual closing accent", { x: editorialInteriorsV1VisualSystem.layout.closing.accentX, y: 0, width: editorialInteriorsV1VisualSystem.layout.closing.accentWidth, height: editorialInteriorsV1VisualSystem.layout.closing.accentHeight });
assert(editorialInteriorsV1VisualSystem.layout.closing.contactRuleY < editorialInteriorsV1VisualSystem.layout.closing.contactTextY, "Visual contact rule must precede contact copy.");
assert(corporateServicesV1VisualSystem.layout.closing.contactRuleY < corporateServicesV1VisualSystem.layout.closing.contactTextY, "Corporate contact rule must precede contact copy.");
assert(productTechV1VisualSystem.layout.closing.contactRuleY < productTechV1VisualSystem.layout.closing.contactTextY, "Product contact rule must precede contact copy.");

Object.entries(editorialInteriorsProjectTextGeometry).forEach(([templateId, cells]) => cells.forEach((cell, index) => {
  assertTextFrame(`${templateId} project ${index + 1} title`, cell.title);
  assertTextFrame(`${templateId} project ${index + 1} description`, cell.description);
  assert(cell.clearanceMm > 0, `${templateId} project ${index + 1} must retain positive title/description clearance.`);
}));

assert(CORPORATE_SERVICES_TEXT_GEOMETRY.top >= 0 && CORPORATE_SERVICES_TEXT_GEOMETRY.bottom <= page.height, "Corporate service rows must remain inside A4.");
assertFrame("Corporate single-service continuation card", CORPORATE_SINGLE_CONTINUATION_GEOMETRY.card);
assert(CORPORATE_SINGLE_CONTINUATION_GEOMETRY.title.y < CORPORATE_SINGLE_CONTINUATION_GEOMETRY.dividerY, "Corporate single-service title must precede its divider.");
assert(corporateServicesNarrativeAlternateTemplate.id !== corporateServicesNarrativeSparseTemplate.id, "Corporate detail pages must expose a bounded alternate composition.");
Object.entries(PRODUCT_FEATURE_CONTINUATION_GEOMETRY).forEach(([count, geometry]) => {
  geometry.cells.forEach((cell, index) => assert(cell.x >= 0 && cell.y >= 0 && cell.x + geometry.textWidth <= page.width && cell.bottom <= page.height, `Product feature cell ${count}:${index + 1} must remain inside A4.`));
  geometry.verticalRules.forEach((rule) => assert(rule.x >= 0 && rule.x <= page.width && rule.y1 >= 0 && rule.y2 <= page.height, `Product feature vertical rule ${count} must remain inside A4.`));
});
const corporateContinuationInput: CorporateServicesPageContent = { contentId: "services:continuation", heading: "Additional Services", supportingLine: "A focused continuation.", services: [{ contentId: "service:5", index: "05", title: "Project Coordination", description: "Coordinated delivery across the project lifecycle." }] };
const corporateContinuation = corporateServicesContinuationTemplates[0].prepare(corporateContinuationInput);
assert(corporateContinuation.compatible, "Corporate one-item continuation must preflight.");
if (corporateContinuation.compatible) {
  const audit = corporateServicesContinuationTemplates[0].render(new jsPDF({ unit: "mm", format: "a4" }), corporateContinuation.instance);
  assert(audit.renderedTextBySlot.service0Title?.join(" ") === "Project Coordination" && Boolean(audit.renderedTextBySlot.service0Description?.length), "Corporate one-item continuation must retain all service content.");
}
const corporateNarrativeInput: CorporateNarrativeContent = { contentId: "detail:1", title: "Our Advisory Approach", body: "Advisory teams structure practical solutions with leadership groups.", supportingLine: "Northbridge Advisory practical work." };
assert(corporateServicesNarrativeAlternateTemplate.prepare(corporateNarrativeInput).compatible, "Corporate alternate narrative must preflight.");
const productThreeInput: ProductFeaturesPageContent = { contentId: "features:continuation", heading: "More Capabilities", supportingLine: "", features: ["01", "02", "03"].map((index) => ({ contentId: `feature:${index}`, index, title: `Capability ${index}`, description: "A focused product capability description." })) };
const productThree = productFeatureContinuationTemplates[2].prepare(productThreeInput);
assert(productThree.compatible, "Product three-item continuation must preflight.");
if (productThree.compatible) {
  const audit = productFeatureContinuationTemplates[2].render(new jsPDF({ unit: "mm", format: "a4" }), productThree.instance);
  assert([0, 1, 2].every((index) => audit.renderedTextBySlot[`feature${index}Title`]?.length && audit.renderedTextBySlot[`feature${index}Description`]?.length), "Product three-item continuation must retain all feature content.");
  assert(new Set(PRODUCT_FEATURE_CONTINUATION_GEOMETRY[3].cells.map((cell) => cell.y)).size === 1, "Product three-item continuation must use a balanced shared row.");
  assert(PRODUCT_FEATURE_CONTINUATION_GEOMETRY[3].textWidth === 52, "Product three-item continuation must reserve non-overlapping column text widths.");
}

const closingCases = [
  { name: "Visual / Portfolio", template: editorialInteriorsClosingTemplate, withContact: false },
  { name: "Visual / Portfolio with contact", template: editorialInteriorsClosingTemplate, withContact: true },
  { name: "Corporate / Services", template: corporateServicesClosingTemplate, withContact: false },
  { name: "Corporate / Services with contact", template: corporateServicesClosingTemplate, withContact: true },
  { name: "Product / Tech", template: productTechClosingTemplate, withContact: false },
  { name: "Product / Tech with contact", template: productTechClosingTemplate, withContact: true },
] as const;

closingCases.forEach(({ name, template, withContact }) => {
  const prepared = template.prepare({ contentId: "closing-test", companyName: "Layout Test Company", descriptor: "Deterministic test profile", ...(withContact ? { contactLines: "hello@example.com" } : {}) });
  assert(prepared.compatible, `${name} closing must preflight.`);
  if (!prepared.compatible) return;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const audit = template.render(pdf, prepared.instance);
  assert(pdf.getNumberOfPages() === 1, `${name} closing must render exactly one page.`);
  assert(Boolean(audit.renderedTextBySlot.companyName), `${name} closing must keep the company identity.`);
  assert(Boolean(audit.renderedTextBySlot.contactLines) === withContact, `${name} closing contact rendering must remain conditional.`);
});

console.log("Three-family visual refinement geometry and closing checks passed.");
