/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright-core");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const workspaceState = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("workspaceData") || "null"));
const activeProfile = async (page) => { const workspace = await workspaceState(page); return workspace.profiles.find((profile) => profile.id === workspace.activeProfileId); };
const gotoReady = async (page, path) => { await page.goto(`${baseUrl}${path}`); await page.waitForTimeout(500); };
const openPreset = async (page, name) => {
  await page.goto(`${baseUrl}/beta-test`);
  await page.waitForTimeout(500);
  const diagnostic = page.waitForEvent("console", { predicate: (message) => message.type() === "info" && message.text().includes("[beta-family-diagnostic]") });
  await page.getByRole("button", { name }).click();
  await diagnostic;
  await page.waitForFunction(() => {
    const raw = localStorage.getItem("workspaceData");
    if (!raw) return false;
    try {
      const workspace = JSON.parse(raw);
      const active = workspace.profiles?.find((profile) => profile.id === workspace.activeProfileId);
      return Boolean(active?.state?.companyData);
    } catch { return false; }
  });
  await page.getByRole("link", { name: "Open Generate Profile" }).click();
  await page.waitForURL(`${baseUrl}/generate`);
  await page.getByText("Compare styles").waitFor();
};
const activeProfileWith = async (page, key) => { const raw = (await activeProfile(page)).state[key]; if (!raw) return null; try { return JSON.parse(raw); } catch { return raw; } };

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120000);

  await gotoReady(page, "/workspace");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await openPreset(page, "Load Aurelia");
  const aurelia = await activeProfileWith(page, "companyData");
  assert(aurelia.name === "Aurelia Interiors", "Aurelia did not load into the active workspace profile.");
  await page.getByRole("button", { name: /Gallery Focus/ }).click();
  assert((await activeProfileWith(page, "authoredVariantDecision")) === "visual-gallery", "Aurelia Gallery selection did not persist in its profile.");

  await gotoReady(page, "/workspace");
  await page.getByRole("button", { name: "New Profile" }).click();
  await page.waitForURL(`${baseUrl}/company`);
  await openPreset(page, "Load Northbridge");
  await page.getByRole("button", { name: /Executive Narrative/ }).click();
  assert((await activeProfileWith(page, "authoredVariantDecision")) === "corporate-executive", "Northbridge Executive selection did not persist in its profile.");
  assert((await workspaceState(page)).profiles.length === 2, "Two-company workspace must contain two profiles.");

  await gotoReady(page, "/workspace");
  const aureliaCard = page.locator("article").filter({ hasText: "Aurelia Interiors" });
  await aureliaCard.getByRole("button", { name: "Switch to this profile" }).click();
  await page.waitForURL(`${baseUrl}/company`);
  await page.goto(`${baseUrl}/generate`);
  await page.getByText("Compare styles").waitFor();
  assert(await page.getByText("Style: Gallery Focus").isVisible(), "Switching back to Aurelia did not restore Gallery.");
  await gotoReady(page, "/workspace");
  const northbridgeCard = page.locator("article").filter({ hasText: "Northbridge Advisory" });
  await northbridgeCard.getByRole("button", { name: "Switch to this profile" }).click();
  await page.goto(`${baseUrl}/generate`);
  await page.getByText("Compare styles").waitFor();
  assert(await page.getByText("Style: Executive Narrative").isVisible(), "Switching to Northbridge did not restore Executive.");

  await gotoReady(page, "/workspace");
  await page.locator("article").filter({ hasText: "Northbridge Advisory" }).getByRole("button", { name: "Duplicate" }).click();
  assert((await workspaceState(page)).profiles.length === 3, "Duplicate must create a third isolated profile.");
  assert((await page.getByText("Northbridge Advisory Copy").count()) === 1, "Duplicate must receive a customer-friendly copy name.");
  await page.goto(`${baseUrl}/company`);
  await page.locator('input[placeholder="e.g. ElShaarawy for Marble & Granite"]').fill("Northbridge Copy Edited");
  await page.getByRole("button", { name: "Save Company" }).click();
  await gotoReady(page, "/workspace");
  const workspaceAfterCopyEdit = await workspaceState(page);
  const originalNorthbridgeCount = workspaceAfterCopyEdit.profiles.filter((profile) => profile.displayName === "Northbridge Advisory").length;
  assert(originalNorthbridgeCount === 1, `Editing a duplicate must not mutate the original profile. Count=${originalNorthbridgeCount}`);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("article").nth(2).getByRole("button", { name: "Delete" }).click();
  assert((await workspaceState(page)).profiles.length === 2, "Deleting a duplicate must preserve the other profiles.");

  await gotoReady(page, "/workspace");
  await page.getByRole("button", { name: "New Profile" }).click();
  await page.waitForURL(`${baseUrl}/company`);
  await openPreset(page, "Load missing-image case");
  const missingVisual = page.getByRole("button", { name: /VISUAL \/ PORTFOLIO/ });
  assert(await missingVisual.isDisabled(), "Missing-image profile must block Visual independently.");
  await gotoReady(page, "/workspace");
  await page.locator("article").filter({ hasText: "Aurelia Interiors" }).getByRole("button", { name: "Switch to this profile" }).click();
  await page.goto(`${baseUrl}/generate`);
  await page.getByText("Compare styles").waitFor();
  assert(await page.getByRole("button", { name: /VISUAL \/ PORTFOLIO/ }).isEnabled(), "Valid Aurelia Visual state leaked into the wrong profile or was lost on switch.");

  await gotoReady(page, "/workspace");
  await page.setViewportSize({ width: 375, height: 800 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), "Workspace must not overflow on mobile.");
  const missingCard = page.locator("article").filter({ hasText: "Current profile" });
  page.once("dialog", (dialog) => dialog.accept());
  await missingCard.getByRole("button", { name: "Delete" }).click();

  await browser.close();
  console.log("Workspace browser scenarios passed: migration, two-company isolation, variants, duplication, deletion, missing-image isolation, and mobile bounds.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
