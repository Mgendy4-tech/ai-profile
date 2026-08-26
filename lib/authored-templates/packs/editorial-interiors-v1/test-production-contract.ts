import { adaptProductionContentToEditorialInteriorsV1 } from "../../adapter";
import { enrichProductionContentForAuthoredTemplates, type ProductionEnrichmentInput } from "../../enrichment";
import type { ImageSlotValue, PreparedTextSlot } from "../../types";
import { editorialInteriorsCoverTemplate } from "./cover";
import { editorialInteriorsProjectFeatureTemplate } from "./project-feature";
import { prepareEditorialInteriorsV1Document, renderPreparedEditorialInteriorsV1Document } from "./index";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const hero: ImageSlotValue = { role: "project_image", provenance: "user_upload", format: "PNG", width: 1200, height: 1600, source: PNG };

const run = async () => {
const coverNames = ["Aurelia Interior Studio", "Luma", "Ili & Ili Studios Limited"];
for (const companyName of coverNames) {
  const prepared = editorialInteriorsCoverTemplate.prepare({ contentId: "company", documentLabel: "COMPANY PROFILE", companyName, hero });
  assert(prepared.compatible, `${companyName} must fit at fixed approved typography.`);
  if (prepared.compatible) {
    const slot = prepared.instance.preparedSlots.companyName as PreparedTextSlot;
    assert(slot.source === companyName && slot.lines.length <= 3, "Cover preparation must preserve the raw name and deterministically wrap to at most three lines.");
    const repeated = editorialInteriorsCoverTemplate.prepare({ contentId: "company", documentLabel: "COMPANY PROFILE", companyName, hero });
    assert(repeated.compatible && JSON.stringify(slot.lines) === JSON.stringify((repeated.instance.preparedSlots.companyName as PreparedTextSlot).lines), "Cover wrapping must be deterministic.");
  }
}
assert(!editorialInteriorsCoverTemplate.prepare({ contentId: "company", documentLabel: "COMPANY PROFILE", companyName: Array.from({ length: 20 }, () => "UnfitCompanyName").join(" "), hero }).compatible, "Over-capacity raw company names must fail without shrinking.");

const production = (): ProductionEnrichmentInput => ({
  company: { name: "Aurelia Interior Studio", about: "Exact truthful company narrative.", activities: "Exact activities.", experience: "Exact experience." },
  profile: {
    companyName: "Aurelia Interior Studio",
    companyType: "Interior studio",
    sections: [
      { id: "about", title: "About Aurelia", description: "Direct section description.", content: "Exact truthful company narrative.", items: [] },
      { id: "services", title: "Capabilities", description: "Direct capability introduction.", content: "Direct capability content.", items: [
        { name: "Spatial planning", description: "Direct service description one." },
        { name: "Material direction", description: "Direct service description two." },
        { name: "Interior detailing", description: "Direct service description three." },
        { name: "Visual curation", description: "Direct service description four." },
      ] },
    ],
  },
  projects: [{ id: "project-1", name: "Authentic Project", description: "Exact authentic project description.", imageUrl: PNG }],
});

const source = production();
const before = JSON.stringify(source);
const enriched = await enrichProductionContentForAuthoredTemplates(source, async () => ({ width: 1200, height: 1600 }));
assert(enriched.roleReadiness.every((role) => role.status === "candidate_available"), "Current production schema must construct all four minimum truthful page contracts when four services and an authentic project image exist.");
assert(JSON.stringify(source) === before, "Production contract correction must not mutate source data.");
assert(enriched.adapterInput.authoredPages.narrative?.callout === undefined && enriched.adapterInput.authoredPages.narrative?.secondaryBlock === undefined, "Narrative mapping must not invent optional callout or second-block content.");
assert(enriched.adapterInput.authoredPages.capabilities?.capabilities.every((item) => item.items.length === 0), "Flat services must not acquire synthetic bullets.");
assert(enriched.adapterInput.authoredPages.projectFeature?.info === undefined && enriched.adapterInput.authoredPages.projectFeature?.scope === undefined, "Project mapping must not invent metadata, KPIs, scope, or deliverables.");

const adapted = adaptProductionContentToEditorialInteriorsV1(enriched.adapterInput);
assert(adapted.readyPageRoles.length === 4, "All four corrected candidates must pass the existing preflight system.");
const candidates = adapted.pages;
if (candidates.cover.status !== "ready" || candidates.narrative.status !== "ready" || candidates.capabilities.status !== "ready" || candidates.projectFeature.status !== "ready") throw new Error("Expected four ready candidates.");
const document = prepareEditorialInteriorsV1Document({ cover: candidates.cover.candidate, narrative: candidates.narrative.candidate, capabilities: candidates.capabilities.candidate, projectFeature: candidates.projectFeature.candidate });
assert(document.compatible, "Minimum truthful production document must prepare as a full pack.");
if (!document.compatible) throw new Error("Expected compatible production document.");
const rendered = renderPreparedEditorialInteriorsV1Document(document.document);
rendered.audits.forEach((audit, index) => Object.entries(audit.renderedTextBySlot).forEach(([slotId, lines]) => {
  const prepared = document.document.instances[index].preparedSlots[slotId] as PreparedTextSlot;
  assert(prepared.lines === lines, `Renderer must consume prepared lines exactly for ${slotId}.`);
}));
const renderedAgain = renderPreparedEditorialInteriorsV1Document(document.document);
assert(Buffer.from(rendered.pdf.output("arraybuffer")).equals(Buffer.from(renderedAgain.pdf.output("arraybuffer"))), "Corrected minimum production output must be deterministic.");
assert(new Set(document.document.consumedContentIds).size === 4, "Every page must consume its exact source content ID once.");

const optionalProject = editorialInteriorsProjectFeatureTemplate.prepare({ contentId: "project-1", title: "Authentic Project", hero, overviewBody: "Exact authentic project description.", info: [{ label: "CATEGORY", value: "Residential" }, { label: "SOURCE", value: "User supplied" }, { label: "TYPE", value: "Interior" }], scope: { title: "Verified scope", items: ["Verified item"] } });
assert(optionalProject.compatible, "Verified optional metadata must remain supported when genuinely supplied.");

const excess = production();
(excess.profile.sections[1].items as Array<{ name: string; description: string }>).push({ name: "Fifth", description: "Excess direct service." });
const excessResult = await enrichProductionContentForAuthoredTemplates(excess, async () => ({ width: 1200, height: 1600 }));
assert(excessResult.roleReadiness.find((role) => role.pageRole === "capabilities")?.status !== "candidate_available", "Excess service groups must be rejected without dropping content.");

console.log("Phase C.6 production contract tests passed.");
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
