import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createBetaFixture } from "../beta-test-fixtures";
import { routeEditorialInteriorsV1Export } from "./export-orchestrator";
import { variantsForFamily } from "./variant-registry";

const image = `data:image/jpeg;base64,${readFileSync(resolve("lib/test-fixtures/visual/aurelia-browser-upload.jpg")).toString("base64")}`;
const inputs = [
  ["visual-portfolio", createBetaFixture("aurelia", image)],
  ["corporate-services", createBetaFixture("northbridge", image)],
  ["product-tech", createBetaFixture("winx", image)],
] as const;
const decoder = async () => ({ width: 1600, height: 1200 });

const main = async () => {
for (const [familyId, fixture] of inputs) {
  const variants = variantsForFamily(familyId);
  for (const variant of variants) {
    const decision = await routeEditorialInteriorsV1Export({ company: fixture.company, profile: fixture.generatedProfile, projects: fixture.projects }, decoder, "source", familyId, variant.id);
    assert.equal(decision.mode, "authored", `${fixture.id}/${variant.id} must render through the authored path: ${decision.mode === "fallback" ? JSON.stringify(decision.reasons) : ""}`);
    if (decision.mode !== "authored") continue;
    assert.equal(decision.familyId, familyId);
    assert.equal(decision.variantId, variant.id);
    assert.equal(decision.pageOrder.at(-1)?.endsWith(".closing"), true, `${variant.id} must end with its family closing page.`);
    assert.equal(decision.pageOrder.length, decision.pdf.getNumberOfPages(), `${variant.id} plan and render page counts must match.`);
    const rawPages = (decision.pdf.internal as unknown as { pages: string[][] }).pages;
    assert(rawPages.slice(1).every((page) => page.join("").trim().length > 0), `${variant.id} must not create blank pages.`);
    for (let page = 1; page <= decision.pdf.getNumberOfPages(); page += 1) {
      decision.pdf.setPage(page);
      assert.equal(Math.round(decision.pdf.internal.pageSize.getWidth()), 210, `${variant.id} page ${page} must be A4 width.`);
      assert.equal(Math.round(decision.pdf.internal.pageSize.getHeight()), 297, `${variant.id} page ${page} must be A4 height.`);
    }
    const raw = rawPages.flat().join("\n");
    assert(!/source-backed|source-supplied|supplied project|planner instruction|grounded in supplied/i.test(raw), `${variant.id} exposed internal presentation copy.`);
    assert(raw.includes(fixture.company.name), `${variant.id} dropped the company identity.`);
    if (fixture.id === "aurelia") assert(raw.includes("Riverside Residence"), `${variant.id} dropped the canonical project name.`);
  }
}

const stale = await routeEditorialInteriorsV1Export({ company: inputs[0][1].company, profile: inputs[0][1].generatedProfile, projects: inputs[0][1].projects }, decoder, "source", "visual-portfolio", "corporate-structured");
assert(stale.mode === "authored" && stale.variantId === "visual-editorial", "Cross-family stale style must be normalized before export.");

console.log("All six authored family/style combinations render safely with A4 bounds, closing pages, and semantic copy coverage.");
};

main().catch((error) => { console.error(error); process.exitCode = 1; });
