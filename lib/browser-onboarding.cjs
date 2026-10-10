/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright-core");
const { resolve } = require("node:path");

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const imagePath = resolve("lib/test-fixtures/visual/aurelia-browser-upload.jpg");

const selectedSections = [
  { id: "about", displayTitle: "About Aurelia", description: "Introduce the studio using its company information." },
  { id: "services", displayTitle: "Interior Design Capabilities", description: "Present the supported interior design capabilities.", semanticRole: "services", items: [
    ...["Interior Design", "Space Planning", "Material Selection", "Furniture Selection"].map((title, index) => ({ id: `services:service:${index + 1}`, title, description: `${title} for refined residential interiors.` })),
  ] },
  { id: "expertise", displayTitle: "Residential Expertise", description: "Describe the studio's residential design expertise." },
  { id: "approach", displayTitle: "Design Approach", description: "Describe the material-led design approach." },
  { id: "projects", displayTitle: "Selected Projects", description: "Present the saved residential project.", semanticRole: "projects" },
];
const generatedSections = [
  { id: "about", title: selectedSections[0].displayTitle, description: selectedSections[0].description, content: "With 8 years of experience, Aurelia Interiors creates refined residential interiors around warm natural materials and calm neutral palettes.", items: [] },
  { id: "services", title: selectedSections[1].displayTitle, description: selectedSections[1].description, content: "Aurelia Interiors provides interior design, space planning, material selection, and furniture selection.", items: selectedSections[1].items.map((item) => ({ id: item.id, name: item.title, description: item.description, sourceEvidence: item.title })) },
  { id: "expertise", title: selectedSections[2].displayTitle, description: selectedSections[2].description, content: "Residential interiors shaped around materials, spatial planning, and a calm visual language.", items: [] },
  { id: "approach", title: selectedSections[3].displayTitle, description: selectedSections[3].description, content: "A material-led design approach balancing function, natural finishes, and a refined residential character.", items: [] },
  { id: "projects", title: selectedSections[4].displayTitle, description: selectedSections[4].description, content: "Riverside Residence is a completed residential project featuring warm natural materials and layered lighting.", items: [{ id: "projects:project:1", name: "Riverside Residence", description: "A contemporary residential interior shaped through warm natural materials and a calm neutral palette." }] },
];

const progressTexts = async (page) => page.getByRole("region", { name: "Profile setup progress" }).getByRole("listitem").allTextContents();
const assertProgressReady = async (page, label) => {
  const texts = await progressTexts(page);
  assert(texts.length === 4 && texts.every((text) => text.includes("Ready")), `${label} progress did not report all four steps ready: ${texts.join(" | ")}`);
};
const assertNoHorizontalOverflow = async (page, label) => assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${label} has horizontal overflow.`);
const assertNoInternalCopy = async (page, label) => {
  const body = await page.locator("body").innerText();
  assert(!/localStorage|projectsData|generatedProfile|sourceFingerprint|persisted_/i.test(body), `${label} exposes internal storage or diagnostic terminology.`);
};

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120000);

  await page.goto(`${baseUrl}/company`);
  await page.getByRole("button", { name: "Clear local data" }).click();
  await page.getByRole("button", { name: "Yes, clear it" }).click();
  await page.waitForURL(`${baseUrl}/`);

  await page.goto(`${baseUrl}/company`);
  assert(await page.getByText(/Start with the essentials/i).isVisible(), "First-time company guidance is missing.");
  assert(await page.getByRole("region", { name: "Profile setup progress" }).getByText("Needs attention").count() >= 1, "First-time progress does not identify the incomplete company step.");
  await page.locator('input[placeholder^="e.g. ElShaarawy"]').fill("Aurelia Interiors");
  await page.locator('textarea[placeholder="Tell us about the company..."]').fill("Aurelia creates refined residential interiors around warm natural materials and calm neutral palettes.");
  await page.locator('input[placeholder^="e.g. Professional services"]').fill("Interior Design Studio");
  await page.getByRole("button", { name: "Save Company" }).click();
  await page.waitForURL("**/generate");
  assert(await page.evaluate(() => Boolean(localStorage.getItem("companyData"))), "Company save did not persist canonical data.");
  await page.getByText(/Your saved company data is ready to be analyzed/i).waitFor();
  assert(await page.getByRole("link", { name: "Next: Projects" }).first().isVisible(), "Saved-company guidance did not offer the Projects step.");
  assert((await progressTexts(page))[0].includes("Ready"), "Company did not become complete after saving.");

  await page.getByRole("link", { name: "Next: Projects" }).first().click();
  await page.waitForURL("**/projects");
  await page.locator('input[placeholder="e.g. New Cairo Marble Project"]').fill("Riverside Residence");
  await page.locator('textarea[placeholder="Describe the project..."]').fill("A contemporary residential interior shaped through warm natural materials and a calm neutral palette.");
  await page.getByLabel("Upload Project Image (required)").setInputFiles(imagePath);
  await page.getByAltText("Featured project preview").waitFor();
  await page.getByRole("button", { name: "Save Project" }).click();
  await page.getByRole("heading", { name: "Saved Projects (1)" }).waitFor();
  assert(await page.getByText("Project image ready").isVisible(), "Saved project did not expose a clear ready image state.");
  assert((await progressTexts(page))[1].includes("Ready"), "Projects did not become complete after saving a valid image.");

  await page.route("**/api/analyze-structure", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ companyType: "Interior Design Studio", recommendedSections: selectedSections }) }));
  await page.route("**/api/generate-profile", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ companyType: "Interior Design Studio", sections: generatedSections }) }));
  await page.getByRole("link", { name: /Done.*Continue to Company Profile/ }).click();
  await page.waitForURL("**/generate");
  await page.getByRole("button", { name: "Analyze Saved Company" }).click();
  await page.getByText(/tailored your profile structure/i).waitFor();
  await page.getByRole("button", { name: /This Looks Good|Structure Confirmed/ }).click();
  await page.getByRole("button", { name: "Generate Profile" }).click();
  await page.getByText("Choose a template family").waitFor();
  const visual = page.getByRole("button", { name: /VISUAL \/ PORTFOLIO/i });
  assert(await visual.isEnabled() && await visual.getByText(/AI recommended/i).count() === 1, "Aurelia did not retain the Visual recommendation.");
  await assertProgressReady(page, "Fresh Aurelia");
  assert(await page.getByText("Template family: VISUAL / PORTFOLIO").isVisible(), "Selected family is not shown beside export actions.");
  await assertNoInternalCopy(page, "Fresh Aurelia");
  await page.setViewportSize({ width: 390, height: 844 });
  await assertNoHorizontalOverflow(page, "Mobile Generate");
  assert(await visual.isVisible(), "Visual family card is not usable at mobile width.");
  await page.setViewportSize({ width: 1280, height: 900 });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).first().click();
  await (await downloadPromise).path();

  await page.reload();
  await page.getByText("Choose a template family").waitFor();
  await assertProgressReady(page, "Returning Aurelia");
  assert(await page.getByRole("button", { name: "Download PDF" }).first().isEnabled(), "Returning user lost export readiness.");
  assert(await page.getByRole("link", { name: "Review export" }).isVisible(), "Returning user was reset to first-time guidance.");

  await page.goto(`${baseUrl}/company`);
  await page.locator('textarea[placeholder="Tell us about the company..."]').fill("Aurelia has updated its saved residential design description.");
  await page.getByRole("button", { name: "Save Company" }).click();
  await page.waitForURL("**/generate");
  await page.getByRole("region", { name: "Profile setup progress" }).getByRole("listitem").nth(2).getByText("Needs attention").waitFor();
  assert(await page.getByRole("button", { name: "Analyze Saved Company" }).isVisible(), "Source update did not require profile regeneration.");
  assert(await page.getByRole("button", { name: "Download PDF" }).count() === 0, "Source update left an invalid export-ready state.");

  await page.goto(`${baseUrl}/beta-test`);
  await page.getByRole("button", { name: "Load missing-image case" }).click();
  await page.getByRole("link", { name: "Open Generate Profile" }).click();
  await page.getByText("Choose a template family").waitFor();
  const blockedVisual = page.getByRole("button", { name: /VISUAL \/ PORTFOLIO/i });
  const corporate = page.getByRole("button", { name: /CORPORATE \/ SERVICES/i });
  assert(await blockedVisual.isDisabled(), "Missing-image state left Visual / Portfolio selectable.");
  assert(await corporate.isEnabled(), "Missing-image state incorrectly blocked the service-led family.");
  assert(await page.getByText(/valid PNG or JPEG image/i).isVisible(), "Missing-image state did not show an actionable export message.");
  assert(await page.getByRole("button", { name: "Download PDF" }).first().isDisabled(), "Missing-image state left PDF export enabled.");
  assert(await page.getByAltText("Riverside Residence").count() === 0, "Missing-image state rendered a stale project image.");
  await page.reload();
  assert(await page.getByRole("button", { name: /VISUAL \/ PORTFOLIO/i }).isDisabled(), "Reload restored Visual eligibility for missing-image state.");
  assert(await page.getByText(/valid PNG or JPEG image/i).isVisible(), "Reload lost the actionable missing-image message.");
  await assertNoInternalCopy(page, "Blocked Visual");

  await browser.close();
  console.log("Onboarding browser flow passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
