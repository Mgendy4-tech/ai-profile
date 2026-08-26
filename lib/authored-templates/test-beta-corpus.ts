import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { AUTHORED_BETA_CORPUS } from "./beta-corpus/fixtures";
import { evaluateCorpusRecord, type CorpusEvaluation } from "./beta-corpus/evaluate";
import { isProductTechCompanyType } from "./section-role-normalization";
import { routeEditorialInteriorsV1Export } from "./export-orchestrator";
import type { ProductionEnrichmentInput } from "./enrichment";
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const run = async () => {
  const positiveTypes = ["Workflow automation product", "Workflow automation platform", "Automation software", "SaaS platform", "AI software platform"];
  positiveTypes.forEach((companyType) => assert(isProductTechCompanyType(companyType), `${companyType} must classify as Product / Tech.`));
  const negativeTypes = ["Business process automation consulting", "IT systems consulting", "Workflow optimization services", "Digital transformation services"];
  negativeTypes.forEach((companyType) => assert(!isProductTechCompanyType(companyType), `${companyType} must not classify as Product / Tech.`));
  const serviceInput = (companyType: string): ProductionEnrichmentInput => ({ company: { name: "Service Boundary Fixture", about: "Synthetic test narrative.", activities: "Synthetic test activities.", experience: "Synthetic test experience." }, profile: { companyName: "Service Boundary Fixture", companyType, sections: [{ id: "about", title: "About", description: "Synthetic positioning.", content: "Synthetic source-backed narrative.", items: [] }, { id: "services", title: "Services", description: "Synthetic services.", content: "Synthetic service content.", items: [{ name: "Advisory", description: "Synthetic source-backed service." }] }] }, projects: [] });
  for (const companyType of negativeTypes) { const decision = await routeEditorialInteriorsV1Export(serviceInput(companyType)); assert(decision.mode === "authored" && decision.familyId === "corporate-services", `${companyType} must retain its Corporate / Services path.`); }
  assert(AUTHORED_BETA_CORPUS.length === 15, "Beta corpus must contain exactly fifteen expectation-isolated records.");
  const results: CorpusEvaluation[] = []; for (const record of AUTHORED_BETA_CORPUS) results.push(await evaluateCorpusRecord(record));
  const summary = { total: results.length, authored: results.filter((entry) => entry.selected.mode === "authored").length, safeFallback: results.filter((entry) => entry.classification === "SAFE_FALLBACK").length, misroute: results.filter((entry) => entry.classification === "MISROUTE").length, unsafe: results.filter((entry) => entry.classification === "UNSAFE").length, byFamily: Object.fromEntries(["visual-portfolio", "corporate-services", "product-tech"].map((family) => [family, results.filter((entry) => entry.selected.mode === "authored" && entry.selected.familyId === family).length])) };
  const output = resolve("artifacts", "beta-hardening", "authored-corpus-report.json"); mkdirSync(dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify({ summary, results }, null, 2));
  console.log(JSON.stringify(summary)); console.log(`Beta corpus report: ${output}`);
  results.forEach((result) => { assert(result.classification !== "MISROUTE", `${result.corpusId} must not misroute.`); assert(result.classification !== "UNSAFE", `${result.corpusId} must not lose/reorder content or violate provenance.`); assert(result.registryOrderIndependent, `${result.corpusId} ranking must be registry-order independent.`); assert(result.repeatedResultDeterministic, `${result.corpusId} must be deterministic.`); });
};
run().catch((error) => { console.error(error); process.exitCode = 1; });
