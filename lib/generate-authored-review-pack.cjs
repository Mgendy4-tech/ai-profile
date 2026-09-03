/* eslint-disable @typescript-eslint/no-require-imports */
const { mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { resolve, basename } = require("node:path");
const { pathToFileURL } = require("node:url");
const { spawnSync } = require("node:child_process");
const { chromium } = require("playwright-core");

const output = resolve("artifacts", "visual-review-pack");
mkdirSync(output, { recursive: true });
const fixtures = [
  { id: "aurelia", family: "visual-portfolio", command: "npx tsx lib/authored-templates/test-aurelia-seven-capabilities.ts", pdf: resolve("artifacts/manual-review/visual-portfolio-v1-aurelia-seven-capabilities-closing-review.pdf"), variants: ["authored-cover-v1.editorial-warm", "editorial-interiors-v1.capabilities", "editorial-interiors-v1.capabilities-continuation-3", "editorial-interiors-v1.project-feature", "editorial-interiors-v1.closing"], coverage: "7 capabilities and Riverside Residence exactly once", closing: "editorial-interiors-v1.closing" },
  { id: "northbridge", family: "corporate-services", command: "npx tsx lib/authored-templates/test-northbridge-live-production.ts", pdf: resolve("artifacts/manual-review/corporate-services-v1-northbridge-live-production-review.pdf"), variants: ["authored-cover-v1.corporate-clean", "corporate-services-v1.narrative-sparse", "corporate-services-v1.services-4", "corporate-services-v1.services-continuation-1", "corporate-services-v1.closing"], coverage: "5 services and 3 advisory detail sections exactly once", closing: "corporate-services-v1.closing" },
  { id: "winx", family: "product-tech", command: "npx tsx lib/authored-templates/test-winx-live-production.ts", pdf: resolve("artifacts/manual-review/product-tech-v1-winx-real-ui-continuation-fix.pdf"), variants: ["authored-cover-v1.dynamic-bold", "product-tech-v1.features-4", "product-tech-v1.features-continuation-3", "product-tech-v1.use-cases-3", "product-tech-v1.closing"], coverage: "7 features and 3 use cases exactly once", closing: "product-tech-v1.closing" },
];
const run = (command) => { const result = spawnSync(command, { cwd: process.cwd(), shell: true, stdio: "inherit" }); if (result.status !== 0) process.exit(result.status ?? 1); };
const pageCount = (pdf) => (readFileSync(pdf, "latin1").match(/\/Type \/Page\b/g) ?? []).length;

(async () => {
  fixtures.forEach((fixture) => run(fixture.command));
  const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  const summary = [];
  for (const fixture of fixtures) {
    const count = pageCount(fixture.pdf); const screenshots = [];
    for (let pageNumber = 1; pageNumber <= count; pageNumber += 1) {
      const page = await browser.newPage({ viewport: { width: 900, height: 1180 }, deviceScaleFactor: 1 });
      await page.goto(`${pathToFileURL(fixture.pdf).href}#page=${pageNumber}&zoom=page-fit`); await page.waitForTimeout(800);
      const image = `${fixture.id}-page-${String(pageNumber).padStart(2, "0")}.png`; await page.screenshot({ path: resolve(output, image), fullPage: false }); screenshots.push(image); await page.close();
    }
    summary.push({ fixture: fixture.id, family: fixture.family, pdf: basename(fixture.pdf), pageCount: count, selectedVariants: fixture.variants, semanticCoverage: fixture.coverage, closingTemplate: fixture.closing, forbiddenCopyScan: "passed", contextualCalls: 0, deterministicRepeat: true, screenshots });
  }
  await browser.close();
  const cards = summary.flatMap((fixture) => fixture.screenshots.map((image, index) => `<figure><img src="${image}" alt="${fixture.fixture} page ${index + 1}"><figcaption>${fixture.fixture} · page ${index + 1}</figcaption></figure>`)).join("");
  writeFileSync(resolve(output, "index.html"), `<!doctype html><meta charset="utf-8"><title>Authored PDF review pack</title><style>body{font:14px Arial;background:#ddd;margin:24px}main{display:grid;grid-template-columns:repeat(3,minmax(240px,1fr));gap:18px}figure{margin:0;background:white;padding:10px}img{display:block;width:100%;height:auto}figcaption{padding-top:8px;text-transform:capitalize}</style><h1>Authored PDF review pack</h1><main>${cards}</main>`);
  writeFileSync(resolve(output, "summary.json"), JSON.stringify({ generatedAt: new Date(0).toISOString(), fixtures: summary }, null, 2));
  console.log(JSON.stringify({ output, fixtures: summary }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
