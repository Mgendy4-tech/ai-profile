/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright-core");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const enabled = process.env.EXPECT_BETA_TEST_MODE === "true";
const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext(); const page = await context.newPage();
  await page.goto(`${baseUrl}/beta-test`);
  if (!enabled) {
    assert(await page.getByText("This page is not available.").isVisible(), "Flag-off harness did not render its unavailable state.");
    assert(await page.getByRole("button", { name: /Load Aurelia/ }).count() === 0, "Flag-off harness exposed QA controls.");
  } else {
    assert(await page.getByText("Preview QA only").isVisible(), "Enabled harness lacks its Preview-only badge.");
    await page.evaluate(() => localStorage.setItem("unrelated-origin-state", "keep"));
    await page.getByRole("button", { name: "Load Aurelia" }).click();
    let state = await page.evaluate(() => ({ company: JSON.parse(localStorage.getItem("companyData")), projects: JSON.parse(localStorage.getItem("projectsData")), generated: JSON.parse(localStorage.getItem("generatedProfile")) }));
    assert(state.company.experience === "8" && state.projects[0].name === "Riverside Residence" && state.projects[0].imageUrl.startsWith("data:image/png;base64,"), "Aurelia browser preset did not persist its expected uploaded-style state.");
    assert(state.generated.sections.find((section) => section.id === "services").items.length === 7, "Aurelia browser preset lacks seven capabilities.");
    await page.getByRole("button", { name: "Load Northbridge" }).click(); state = await page.evaluate(() => ({ company: JSON.parse(localStorage.getItem("companyData")), projects: JSON.parse(localStorage.getItem("projectsData")), generated: JSON.parse(localStorage.getItem("generatedProfile")) }));
    assert(state.company.experience === "1" && state.projects.length === 0 && state.generated.sections.find((section) => section.id === "services").items.length === 5, "Northbridge browser preset is invalid.");
    await page.getByRole("button", { name: "Load WinX" }).click(); state = await page.evaluate(() => ({ projects: JSON.parse(localStorage.getItem("projectsData")), generated: JSON.parse(localStorage.getItem("generatedProfile")) }));
    assert(state.projects.length === 0 && state.generated.sections.some((section) => section.id === "features") && state.generated.sections.some((section) => section.id === "useCases"), "WinX browser preset is invalid.");
    await page.getByRole("button", { name: "Load generated-only project case" }).click(); state = await page.evaluate(() => ({ projects: JSON.parse(localStorage.getItem("projectsData")), generated: JSON.parse(localStorage.getItem("generatedProfile")) }));
    assert(state.projects.length === 0 && state.generated.sections.find((section) => section.id === "projects").items.length === 1, "Generated-only browser preset lost explicit project evidence.");
    await page.getByRole("button", { name: "Clear test state" }).click(); const cleared = await page.evaluate(() => ({ app: ["companyData","projectsData","profileStructure","generatedProfile","authoredFamilyDecision","exportDecision"].map((key) => localStorage.getItem(key)), unrelated: localStorage.getItem("unrelated-origin-state") }));
    assert(cleared.app.every((value) => value === null) && cleared.unrelated === "keep", "Harness clear action crossed the application-owned storage boundary.");
  }
  const companyResponse = await page.goto(`${baseUrl}/company`); const generateResponse = await page.goto(`${baseUrl}/generate`);
  assert(companyResponse?.status() === 200 && generateResponse?.status() === 200, "Normal production pages did not remain available.");
  await browser.close(); console.log(`Beta QA harness production-browser test passed with flag ${enabled ? "on" : "off"}.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
