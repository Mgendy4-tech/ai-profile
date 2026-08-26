import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { auditProductionIntegration, evaluateProductionScenario } from "./real-user-beta/evaluate";
import { REAL_USER_BETA_SCENARIOS } from "./real-user-beta/fixtures";
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const run = async () => {
  assert(REAL_USER_BETA_SCENARIOS.length === 12, "Real-user beta matrix must contain twelve scenarios.");
  const integration = auditProductionIntegration(); assert(integration.singleOrchestratorReachable && integration.authoredReturnsBeforeLegacy && integration.legacyFallbackReachable, "Production export must use one authored orchestrator and preserve legacy fallback."); assert(integration.familiesRegistered.join("|") === "visual-portfolio|corporate-services|product-tech", "All three frozen families must remain registered and reachable.");
  const results: Awaited<ReturnType<typeof evaluateProductionScenario>>[] = []; for (const scenario of REAL_USER_BETA_SCENARIOS) results.push(await evaluateProductionScenario(scenario));
  const blockerKinds = ["MISROUTE", "CONTENT_LOSS", "RENDER_FAILURE", "NONDETERMINISTIC"] as const; const blockers = Object.fromEntries(blockerKinds.map((kind) => [kind, results.filter((result) => result.classification === kind).length]));
  const summary = { total: results.length, passAuthored: results.filter((result) => result.classification === "PASS_AUTHORED").length, passSafeFallback: results.filter((result) => result.classification === "PASS_SAFE_FALLBACK").length, blockers, familySelection: Object.fromEntries(integration.familiesRegistered.map((family) => [family, results.filter((result) => result.selectedFamily === family).length])) };
  const reportPath = resolve("artifacts", "beta-hardening", "real-user-beta-phase-1-report.json"); mkdirSync(dirname(reportPath), { recursive: true }); writeFileSync(reportPath, JSON.stringify({ generatedAt: "deterministic-test-run", verdict: Object.values(blockers).every((count) => count === 0) ? "READY_FOR_CONTROLLED_EXTERNAL_BETA" : "BLOCKED", summary, productionIntegration: integration, results }, null, 2));
  results.forEach((result) => assert(!blockerKinds.includes(result.classification as typeof blockerKinds[number]), `${result.scenarioId} is blocked as ${result.classification}.`));
  assert(summary.passAuthored === 9 && summary.passSafeFallback === 3, "Expected nine authored documents and three safe fallbacks.");
  console.log(JSON.stringify(summary)); console.log(`Real-user beta report: ${reportPath}`);
};
run().catch((error) => { console.error(error); process.exitCode = 1; });
