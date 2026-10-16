/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn, spawnSync } = require("node:child_process");

const full = process.argv.includes("--full");
const commands = [
  "npx tsx lib/authored-templates/test-library-core.ts",
  "npx tsx lib/authored-templates/test-content-envelope.ts",
  "npx tsx lib/test-generated-profile-boundary.ts",
  "npx tsx lib/test-local-profile-data.ts",
  "npx tsx lib/test-workspace.ts",
  "npx tsx lib/test-workspace-open-navigation.ts",
  "npx tsx lib/test-cloud-workspace.ts",
  "npx tsx lib/test-customer-ready-storage.ts",
  "npx tsx lib/test-supabase-migration-safety.ts",
  "npx tsx lib/test-auth-session.ts",
  "npx tsx lib/test-production-safety.ts",
  "npx tsx lib/test-openai-runtime-initialization.ts",
  "npx tsx lib/test-auth-gate.ts",
  "npx tsx lib/test-observability.ts",
  "npx tsx lib/test-billing-entitlements.ts",
  "npx tsx lib/test-site-url.ts",
  "npx tsx lib/test-seo-routes.ts",
  "npx tsx lib/test-password-recovery.ts",
  "npx tsx lib/test-password-recovery-context.ts",
  "npx tsx lib/test-password-recovery-errors.ts",
  "npx tsx lib/visual-system/test-vision-image-normalizer.ts",
  "npx tsx lib/test-brand-identity.ts",
  "npx tsx lib/test-manual-beta-corrections.ts",
  "npx tsx lib/test-beta-test-harness.ts",
  "npx tsx lib/authored-templates/test-presentation-copy.ts",
  "npx tsx lib/authored-templates/test-export-orchestrator.ts",
  "npx tsx lib/authored-templates/test-aurelia-seven-capabilities.ts",
  "npx tsx lib/authored-templates/test-visual-layout-polish.ts",
  "npx tsx lib/authored-templates/test-visual-portfolio-multi-project.ts",
  "npx tsx lib/authored-templates/test-corporate-services.ts",
  "npx tsx lib/authored-templates/test-product-tech.ts",
  "npx tsx lib/authored-templates/test-aurelia-real-ui-state.ts",
  "npx tsx lib/authored-templates/test-northbridge-live-production.ts",
  "npx tsx lib/authored-templates/test-winx-live-production.ts",
  "npx tsx lib/authored-templates/test-three-family-architecture.ts",
  "npx tsx lib/authored-templates/test-variant-registry.ts",
  "npx tsx lib/authored-templates/test-variant-preview.ts",
  "npx tsx lib/authored-templates/test-variant-rendering.ts",
  "npx tsc --noEmit",
];

const run = (command, env = process.env) => {
  console.log(`\n> ${command}`);
  const timeout = command.includes("browser-") ? Number(env.QA_BROWSER_TIMEOUT_MS || 16 * 60_000) : undefined;
  const result = spawnSync(command, { cwd: process.cwd(), env, shell: true, stdio: "inherit", ...(timeout ? { timeout } : {}) });
  if (result.status !== 0) {
    const failure = new Error(`QA command failed (${result.error?.code ?? result.status ?? 1}): ${command}`);
    failure.exitCode = result.status ?? 1;
    throw failure;
  }
};

commands.forEach((command) => run(command));
if (!full) { console.log("\nBeta QA gate passed."); process.exit(0); }

const env = { ...process.env, NEXT_PUBLIC_BETA_TEST_MODE: "true" };
run("npm run build", env);
const port = process.env.BETA_QA_PORT || "3117";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", port], { cwd: process.cwd(), env, stdio: "inherit" });
const stopServer = () => {
  if (server.exitCode !== null || server.signalCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(server.pid), "/t", "/f"], { stdio: "ignore" });
  else server.kill("SIGTERM");
};
let serverError = null;
server.once("error", (error) => { serverError = error; });
const waitForServer = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (serverError) throw serverError;
    try { if ((await fetch(`http://localhost:${port}/beta-test`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Production QA server did not become ready.");
};
(async () => {
  try {
    await waitForServer();
    const smokeEnv = { ...env, SMOKE_BASE_URL: `http://localhost:${port}`, EXPECT_BETA_TEST_MODE: "true", SMOKE_PRODUCTION_MODE: "1", QA_FIXTURE_HEADER: "local" };
    run("node lib/browser-beta-test-harness.cjs", smokeEnv);
    run("node lib/browser-three-family-go-live.cjs", smokeEnv);
    console.log("\nFull beta QA gate passed.");
  } finally { stopServer(); }
})().catch((error) => { console.error(error); process.exitCode = error?.exitCode ?? 1; });
