import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createBetaFixture } from "../beta-test-fixtures";
import { routeEditorialInteriorsV1Export } from "./export-orchestrator";
import { variantsForFamily } from "./variant-registry";

const outputDirectory = resolve("artifacts", "visual-review-pack", "final-variants");
const image = `data:image/jpeg;base64,${readFileSync(resolve("lib/test-fixtures/visual/aurelia-browser-upload.jpg")).toString("base64")}`;
const fixtures = [
  { fixtureId: "aurelia" as const, familyId: "visual-portfolio" as const },
  { fixtureId: "northbridge" as const, familyId: "corporate-services" as const },
  { fixtureId: "winx" as const, familyId: "product-tech" as const },
];
const decoder = async () => ({ width: 1600, height: 1200 });

const main = async () => {
  mkdirSync(outputDirectory, { recursive: true });
  const outputs: { fixture: string; family: string; variant: string; path: string; pageCount: number }[] = [];
  for (const entry of fixtures) {
    const fixture = createBetaFixture(entry.fixtureId, image);
    for (const variant of variantsForFamily(entry.familyId)) {
      const decision = await routeEditorialInteriorsV1Export({ company: fixture.company, profile: fixture.generatedProfile, projects: fixture.projects }, decoder, "source", entry.familyId, variant.id);
      assert.equal(decision.mode, "authored", `${entry.fixtureId}/${variant.id} must render for final review.`);
      if (decision.mode !== "authored") continue;
      const path = resolve(outputDirectory, `${entry.fixtureId}-${variant.id}.pdf`);
      writeFileSync(path, Buffer.from(decision.pdf.output("arraybuffer")));
      outputs.push({ fixture: entry.fixtureId, family: entry.familyId, variant: variant.id, path, pageCount: decision.pdf.getNumberOfPages() });
    }
  }
  writeFileSync(resolve(outputDirectory, "summary.json"), JSON.stringify({ generatedAt: new Date(0).toISOString(), outputs }, null, 2));
  console.log(JSON.stringify({ outputDirectory, outputs }, null, 2));
};

main().catch((error) => { console.error(error); process.exitCode = 1; });
