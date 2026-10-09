/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright-core");
const { resolve } = require("node:path");

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const applicationKeys = ["companyData", "projectsData", "profileStructure", "generatedProfile", "authoredFamilyDecision", "exportDecision"];
const clearState = () => window.localStorage.clear();
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

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120000);
  await page.goto(`${baseUrl}/beta-test`);
  assert(await page.getByText("This page is not available.").isVisible(), "Production-safety gate exposed the beta harness when beta mode was off.");
  assert(await page.getByRole("button", { name: /Load Aurelia/ }).count() === 0, "Beta controls leaked into the normal product route.");

  await page.goto(`${baseUrl}/company`);
  await page.evaluate(clearState);
  await page.goto(`${baseUrl}/projects`);
  await page.goto(`${baseUrl}/company`);
  await page.waitForTimeout(500);
  await page.locator('input[placeholder^="e.g. ElShaarawy"]').fill("Aurelia Interiors");
  await page.locator('textarea[placeholder="Tell us about the company..."]').fill("Aurelia creates refined residential interiors around warm natural materials and calm neutral palettes.");
  await page.locator('input[placeholder^="e.g. Professional services"]').fill("Interior Design Studio");
  await page.locator('input[placeholder^="e.g. Management Consulting"]').fill("Interior Design");
  await page.locator('input[placeholder^="e.g. B2B, consumers"]').fill("Residential clients");
  await page.locator('textarea[placeholder^="List the services"]').fill("Interior Design, Space Planning, Material Selection, Furniture Selection");
  await page.locator('input[type="number"]').fill("8");
  await page.getByRole("button", { name: "Save Company" }).click();
  await page.waitForURL("**/generate");

  await page.goto(`${baseUrl}/projects`);
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="e.g. New Cairo Marble Project"]').fill("Riverside Residence");
  await page.locator('textarea[placeholder="Describe the project..."]').fill("A contemporary residential interior shaped through warm natural materials and a calm neutral palette.");
  await page.getByLabel("Upload Project Image (required)").setInputFiles(imagePath);
  try { await page.getByAltText("Featured project preview").waitFor(); } catch (error) { console.error(await page.locator("body").innerText()); throw error; }
  await page.getByRole("button", { name: "Save Project" }).click();
  await page.getByRole("heading", { name: "Saved Projects (1)" }).waitFor();

  await page.route("**/api/analyze-structure", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ companyType: "Interior Design Studio", recommendedSections: selectedSections }) }));
  await page.route("**/api/generate-profile", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ companyType: "Interior Design Studio", sections: generatedSections }) }));
  await page.goto(`${baseUrl}/generate`);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Analyze Saved Company" }).click();
  try { await page.getByText(/tailored your profile structure/i).waitFor(); } catch (error) { console.error(await page.locator("body").innerText()); throw error; }
  await page.getByRole("button", { name: /This Looks Good|Structure Confirmed/ }).click();
  await page.getByRole("button", { name: "Generate Profile" }).click();
  try { await page.getByText("Choose a template family").waitFor(); } catch (error) { console.error(await page.locator("body").innerText()); throw error; }
  const visual = page.getByRole("button", { name: /VISUAL \/ PORTFOLIO/i });
  assert(await visual.isEnabled() && await visual.getByText(/AI recommended/i).count() === 1, "Aurelia did not retain the Visual recommendation.");
  await page.evaluate(() => localStorage.setItem("authoredFamilyDecision", "product-tech"));
  await page.reload();
  await page.getByText(/previous family selection is no longer eligible/i).waitFor();
  assert(await page.evaluate(() => localStorage.getItem("authoredFamilyDecision")) === null, "Invalid manual family selection was not cleared.");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF" }).first().click();
  try { await (await downloadPromise).path(); } catch (error) { console.error(await page.locator("body").innerText()); throw error; }
  await page.reload();
  await page.getByRole("button", { name: "Download PDF" }).first().waitFor();
  if (await page.getByRole("button", { name: "Download PDF" }).count() < 1) { console.error(await page.locator("body").innerText()); console.error(await page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, Boolean(localStorage.getItem(key))])), applicationKeys)); throw new Error("Generated profile did not survive reload."); }

  await page.goto(`${baseUrl}/company`);
  await page.locator('textarea[placeholder="Tell us about the company..."]').fill("Aurelia has changed its saved source description.");
  await page.getByRole("button", { name: "Save Company" }).click();
  await page.waitForURL("**/generate");
  assert(await page.getByRole("button", { name: "Analyze Saved Company" }).isVisible(), "Changing company source did not invalidate generated state.");
  assert(await page.getByRole("button", { name: "Download PDF" }).count() === 0, "Stale generated profile remained exportable after source change.");

  await page.goto(`${baseUrl}/company`);
  await page.locator('input[placeholder^="e.g. ElShaarawy"]').waitFor();
  await page.waitForFunction(() => document.querySelector('input[placeholder^="e.g. ElShaarawy"]')?.value === "Aurelia Interiors");
  await page.evaluate(() => localStorage.setItem("companyData", "{malformed"));
  await page.reload();
  try { await page.getByText(/saved company information could not be read/i).waitFor(); } catch (error) { console.error(await page.locator("body").innerText()); console.error(await page.evaluate(() => localStorage.getItem("companyData"))); throw error; }
  await page.goto(`${baseUrl}/projects`);
  await page.waitForTimeout(500);
  await page.evaluate((keys) => { keys.forEach((key) => localStorage.removeItem(key)); }, applicationKeys);
  await page.goto(`${baseUrl}/company`);
  await page.goto(`${baseUrl}/projects`);
  await page.waitForTimeout(500);
  await page.locator('input[placeholder="e.g. New Cairo Marble Project"]').fill("Missing Image Project");
  await page.locator('textarea[placeholder="Describe the project..."]').fill("A project without an image.");
  await page.getByRole("button", { name: "Save Project" }).click();
  await page.getByText(/project name, description, and project image/i).waitFor();
  await browser.close();
  console.log("Real-user readiness browser harness passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
