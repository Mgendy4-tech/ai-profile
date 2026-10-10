/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright-core");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120000);

  await page.goto(`${baseUrl}/beta-test`);
  assert(await page.getByText("Preview QA only").isVisible(), "Variant browser harness requires Preview beta mode.");
  await page.getByRole("button", { name: "Load Aurelia" }).click();
  await page.getByRole("link", { name: "Open Generate Profile" }).click();
  await page.waitForURL(`${baseUrl}/generate`);
  await page.getByText("Choose a template family").waitFor();

  const styleSection = page.locator('[aria-label="Template style selection"]');
  assert(await styleSection.getByRole("button").count() === 2, `Aurelia must expose two Visual styles; found ${await styleSection.getByRole("button").count()}. Body: ${(await page.locator("body").innerText()).slice(-1800)}`);
  assert(await styleSection.getByText(/AI recommended/i).count() === 1, "Aurelia must expose one recommended Visual style.");
  const gallery = styleSection.getByRole("button", { name: /Gallery Focus/ });
  await gallery.click();
  assert(await page.evaluate(() => localStorage.getItem("authoredVariantDecision")) === "visual-gallery", "Manual Visual style selection did not persist canonically.");
  await page.reload();
  await page.getByText("Choose a style").waitFor();
  assert(await styleSection.getByRole("button", { name: /Gallery Focus/ }).getByText("Selected").isVisible(), "Manual Visual style selection did not survive reload.");
  assert(await page.getByRole("button", { name: "Download PDF" }).first().isEnabled(), "Aurelia style override must keep export ready.");

  const corporateFamily = page.getByRole("button", { name: /CORPORATE \/ SERVICES/ });
  assert(await corporateFamily.isEnabled(), "Aurelia service evidence should keep Corporate available for family-switch coverage.");
  await corporateFamily.click();
  assert(await page.evaluate(() => localStorage.getItem("authoredVariantDecision")) === "corporate-structured", "Family change did not normalize to a valid Corporate style.");
  assert(await page.locator('[aria-label="Template style selection"]').getByRole("button", { name: /Gallery Focus/ }).count() === 0, "Cross-family Visual style remained visible after family switch.");

  await page.evaluate(() => localStorage.setItem("authoredVariantDecision", "stale-cross-family-style"));
  await page.reload();
  await page.getByText("Choose a style").waitFor();
  assert(await page.evaluate(() => localStorage.getItem("authoredVariantDecision")) === "corporate-structured", "Invalid persisted style was not normalized safely.");

  await page.goto(`${baseUrl}/beta-test`);
  await page.getByRole("button", { name: "Load missing-image case" }).click();
  await page.getByRole("link", { name: "Open Generate Profile" }).click();
  await page.waitForURL(`${baseUrl}/generate`);
  await page.getByText("Choose a template family").waitFor();
  const missingVisual = page.getByRole("button", { name: /VISUAL \/ PORTFOLIO/ });
  assert(await missingVisual.isDisabled(), "Missing-image state must not make Visual available through styles.");
  assert(await page.getByRole("button", { name: "Download PDF" }).first().isDisabled(), "Missing-image state must not make Visual exportable through styles.");
  assert(await page.getByText(/PDF export is blocked until each saved project/).isVisible(), "Missing-image state must retain actionable safety messaging.");

  await browser.close();
  console.log("Authored variant browser scenarios passed: manual override, reload, family switch, stale normalization, and missing-image safety.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
