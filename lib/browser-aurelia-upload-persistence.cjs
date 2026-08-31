/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright-core");
const { createHash } = require("node:crypto");
const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const BASE_URL = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const IMAGE_PATH = resolve("lib/test-fixtures/visual/aurelia-browser-upload.jpg");
const PDF_PATH = resolve("artifacts/manual-review/aurelia-upload-persistence-review.pdf");

const sections = [
  { id: "about", displayTitle: "About Aurelia", description: "Source-backed studio overview.", semanticRole: "narrative" },
  { id: "services", displayTitle: "Capabilities", description: "Four source-backed services.", semanticRole: "services", items: ["Interior Design", "Residential Design", "Custom Furniture", "Layered Lighting"].map((title, index) => ({ id: `services:item:${index}`, title, description: `${title} grounded in supplied information.` })) },
  { id: "projects", displayTitle: "Selected Projects", description: "Source-backed completed work.", semanticRole: "projects" },
];
const generated = [
  { id: "about", title: "About Aurelia", description: "Source-backed studio overview.", content: "Aurelia Interiors creates refined residential interiors around warm natural materials and calm neutral palettes.", items: [] },
  { id: "services", title: "Capabilities", description: "Four source-backed services.", content: "Interior Design, Residential Design, Custom Furniture, Layered Lighting", items: ["Interior Design", "Residential Design", "Custom Furniture", "Layered Lighting"].map((name, index) => ({ id: `services:item:${index}`, name, description: `${name} grounded in supplied information.`, sourceEvidence: name })) },
  { id: "projects", title: "Selected Projects", description: "Source-backed completed work.", content: "Riverside Residence is a source-backed residential project.", items: [{ name: "Riverside Residence", description: "A contemporary residential interior designed around warm natural materials, layered lighting, custom furniture, and a calm neutral palette." }] },
];

const describeSource = (source) => {
  const match = /^data:([^;,]+)(?:;base64)?,/i.exec(source || "");
  const payload = match ? source.slice(source.indexOf(",") + 1).replace(/\s/g, "") : "";
  return { exists: Boolean(source), sourceType: match ? "data_url" : /^blob:/i.test(source || "") ? "blob_url" : /^https?:/i.test(source || "") ? "remote_url" : typeof source, mimeType: match?.[1]?.toLowerCase() || null, byteLength: match ? Buffer.from(payload, "base64").length : null, blobUrl: /^blob:/i.test(source || ""), objectUrl: /^blob:/i.test(source || "") };
};

(async () => {
  const browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const decisions = []; const runtime = []; const accounting = []; const blocked = []; const contextualCalls = [];
  page.on("console", (message) => { const text = message.text(); if (text.includes("[authored-export-decision]")) decisions.push(text); if (text.includes("[authored-export-runtime]")) runtime.push(text); if (text.includes("[authored-export-accounting]") || text.includes("[authored-export-final]")) accounting.push(text); if (text.includes("[authored-visual-export-blocked]")) blocked.push(text); });
  for (const endpoint of ["analyze-brand", "visual-direction", "select-visuals", "plan-pdf-layout"]) page.on("request", (request) => { if (request.url().includes(`/api/${endpoint}`)) contextualCalls.push(endpoint); });
  await page.route("**/api/analyze-structure", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ companyType: "Interior Design Studio", recommendedSections: sections }) }));
  await page.route("**/api/generate-profile", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ companyType: "Interior Design Studio", sections: generated }) }));

  await page.goto(`${BASE_URL}/company`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  let inputs = page.locator('form input[type="text"]');
  await inputs.nth(0).fill("Aurelia Interiors");
  await page.locator("form textarea").nth(0).fill("Aurelia Interiors creates refined residential interiors around warm natural materials and calm neutral palettes.");
  await inputs.nth(1).fill("Interior Design Studio");
  await page.locator("form textarea").nth(1).fill("Interior Design, Residential Design, Custom Furniture, Layered Lighting");
  await page.getByRole("button", { name: "Save Company" }).click();
  await page.waitForURL("**/generate");

  await page.goto(`${BASE_URL}/projects`);
  await page.getByLabel("Project Name").fill("Riverside Residence");
  await page.getByLabel("Project Type / Category (optional)").fill("Residential Interior");
  await page.getByLabel("Project Description").fill(generated[2].items[0].description);
  await page.getByLabel("Upload Project Image (required)").setInputFiles(IMAGE_PATH);
  await page.getByAltText("Featured project preview").waitFor();
  await page.getByRole("button", { name: "Save Project" }).click();
  await page.getByRole("heading", { name: "Saved Projects (1)" }).waitFor();
  const uploadState = await page.evaluate(() => JSON.parse(localStorage.getItem("projectsData")));
  const projectId = uploadState[0].id;
  const uploadBoundary = { projectId, projectName: uploadState[0].name, imageKeys: Object.keys(uploadState[0]).filter((key) => /image/i.test(key)), ...describeSource(uploadState[0].imageUrl) };
  await page.reload();
  const savedImage = page.getByAltText("Riverside Residence");
  await savedImage.waitFor();
  const uiBoundary = await savedImage.evaluate((image) => ({ complete: image.complete, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, currentSourceType: image.currentSrc.startsWith("data:") ? "data_url" : image.currentSrc.startsWith("blob:") ? "blob_url" : "other" }));

  await page.goto(`${BASE_URL}/company`);
  inputs = page.locator('form input[type="text"]');
  await page.waitForFunction(() => document.querySelector('form input[type="text"]')?.value === "Aurelia Interiors");
  await page.getByRole("button", { name: "Save Company" }).click();
  await page.waitForURL("**/generate");
  const companySaveState = await page.evaluate(() => JSON.parse(localStorage.getItem("projectsData")));
  assert(companySaveState[0]?.id === projectId, "Company save changed Riverside project identity.");
  assert(companySaveState[0]?.imageUrl === uploadState[0].imageUrl, "Company save changed Riverside image bytes/source.");

  await page.getByRole("button", { name: "Analyze Saved Company" }).click();
  await page.getByText(/tailored your profile structure/).waitFor();
  await page.getByRole("button", { name: /This Looks Good|Structure Confirmed/ }).click();
  await page.getByRole("button", { name: "Generate Profile" }).click();
  await page.getByText("Riverside Residence", { exact: true }).last().waitFor();
  const downloadButtons = page.getByRole("button", { name: /Download PDF/ });
  const firstDownload = page.waitForEvent("download"); await downloadButtons.first().click(); const first = await firstDownload;
  const firstBytes = readFileSync(await first.path());
  const secondDownload = page.waitForEvent("download"); await downloadButtons.last().click(); const second = await secondDownload;
  const secondBytes = readFileSync(await second.path());
  writeFileSync(PDF_PATH, firstBytes);
  const raw = firstBytes.toString("latin1");
  assert(firstBytes.equals(secondBytes), "Repeated Riverside export is not byte deterministic.");
  assert(raw.includes("Riverside Residence"), "Riverside is absent from the authored PDF.");
  assert(raw.includes("/Subtype /Image"), "Riverside PDF page contains no raster image object.");
  assert(!/pexels|image credits/i.test(raw), "Legacy contextual imagery entered the Riverside PDF.");
  assert(contextualCalls.length === 0, "Contextual visual APIs were called for project-bearing export.");
  assert(blocked.length === 0, `Authored export was rejected: ${blocked.join(" | ")}`);
  assert(decisions.length === 2 && decisions.every((entry) => entry.includes("familyId: visual-portfolio") && entry.includes("packId: editorial-interiors-v1")), "Riverside did not remain in visual-portfolio/editorial-interiors-v1.");

  console.log(JSON.stringify({ uploadBoundary, savedProjectsUi: uiBoundary, companySave: { projectId: companySaveState[0].id, imageUnchanged: true, ...describeSource(companySaveState[0].imageUrl) }, generatedBoundary: { projectNameVisible: true }, authored: { role: "project_image", provenance: "user_upload", projectId, preflight: "PASS", rejectionCode: null }, pdf: { path: PDF_PATH, pageCount: (raw.match(/\/Type \/Page\b/g) || []).length, bytes: firstBytes.length, sha256: createHash("sha256").update(firstBytes).digest("hex"), repeatedByteIdentical: true, rasterImageObjects: (raw.match(/\/Subtype \/Image/g) || []).length, riversideText: true }, contextualCalls, pexels: false, imageCredits: false, runtime, decisions, accounting }, null, 2));
  await browser.close();
})().catch((error) => { console.error(error); process.exitCode = 1; });
