/* eslint-disable @typescript-eslint/no-require-imports */
const { spawn, spawnSync } = require("node:child_process");

const full = process.argv.includes("--full");
const commands = [
  "npx tsx lib/authored-templates/test-library-core.ts",
  "npx tsx lib/authored-templates/test-content-envelope.ts",
  "npx tsx lib/test-generated-profile-boundary.ts",
  "npx tsx lib/test-local-profile-data.ts",
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
  "npx tsc --noEmit",
];

const run = (command, env = process.env) => {
  console.log(`\n> ${command}`);
  const result = spawnSync(command, { cwd: process.cwd(), env, shell: true, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

commands.forEach((command) => run(command));
if (!full) { console.log("\nBeta QA gate passed."); process.exit(0); }

const env = { ...process.env, NEXT_PUBLIC_BETA_TEST_MODE: "true" };
run("npm run build", env);
const port = "3110";
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", port], { cwd: process.cwd(), env, stdio: "inherit" });
const waitForServer = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(`http://localhost:${port}/beta-test`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("Production QA server did not become ready.");
};
(async () => {
  try {
    await waitForServer();
    const smokeEnv = { ...env, SMOKE_BASE_URL: `http://localhost:${port}`, EXPECT_BETA_TEST_MODE: "true", SMOKE_PRODUCTION_MODE: "1" };
    run("node lib/browser-beta-test-harness.cjs", smokeEnv);
    run("node lib/browser-three-family-go-live.cjs", smokeEnv);
    console.log("\nFull beta QA gate passed.");
  } finally { server.kill(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
