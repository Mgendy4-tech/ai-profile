/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright-core");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const enabled = process.env.EXPECT_BETA_TEST_MODE === "true";
const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext(process.env.QA_FIXTURE_HEADER ? { extraHTTPHeaders: { "x-lnkdit-qa-fixture": process.env.QA_FIXTURE_HEADER } } : {}); const page = await context.newPage();
  await page.goto(`${baseUrl}/beta-test`);
  if (!enabled) {
    assert(await page.getByText("This page is not available.").isVisible(), "Flag-off harness did not render its unavailable state.");
    assert(await page.getByRole("button", { name: /Load Aurelia/ }).count() === 0, "Flag-off harness exposed QA controls.");
  } else {
    assert(await page.getByText("Preview QA only").isVisible(), "Enabled harness lacks its Preview-only badge.");
    const snapshot = () => page.evaluate(() => {
      const workspace = JSON.parse(localStorage.getItem("workspaceData") || "null");
      const profile = workspace?.profiles?.find((entry) => entry.id === workspace.activeProfileId) || workspace?.profiles?.[0];
      const state = profile?.state || {};
      return { company: JSON.parse(state.companyData || "null"), projects: JSON.parse(state.projectsData || "[]"), generated: JSON.parse(state.generatedProfile || "null") };
    });
    await page.evaluate(() => localStorage.setItem("unrelated-origin-state", "keep"));
    await page.getByRole("button", { name: "Load Aurelia" }).click();
    let state = await snapshot();
    assert(state.company.experience === "8" && state.projects[0].name === "Riverside Residence" && state.projects[0].imageUrl.startsWith("data:image/png;base64,"), "Aurelia browser preset did not persist its expected uploaded-style state.");
    assert(state.generated.sections.find((section) => section.id === "services").items.length === 7, "Aurelia browser preset lacks seven capabilities.");
    await page.getByRole("button", { name: "Load Northbridge" }).click(); state = await snapshot();
    assert(state.company.experience === "1" && state.projects.length === 0 && state.generated.sections.find((section) => section.id === "services").items.length === 5, "Northbridge browser preset is invalid.");
    await page.getByRole("button", { name: "Load WinX" }).click(); state = await snapshot();
    assert(state.projects.length === 0 && state.generated.sections.some((section) => section.id === "features") && state.generated.sections.some((section) => section.id === "useCases"), "WinX browser preset is invalid.");
    await page.getByRole("button", { name: "Load generated-only project case" }).click(); state = await snapshot();
    assert(state.projects.length === 0 && state.generated.sections.find((section) => section.id === "projects").items.length === 1, "Generated-only browser preset lost explicit project evidence.");
    await page.getByRole("button", { name: "Clear test state" }).click(); const cleared = await page.evaluate(() => { const workspace = JSON.parse(localStorage.getItem("workspaceData") || "null"); const profile = workspace?.profiles?.find((entry) => entry.id === workspace.activeProfileId) || workspace?.profiles?.[0]; return { app: ["companyData","projectsData","profileStructure","generatedProfile","authoredFamilyDecision","exportDecision"].map((key) => profile?.state?.[key] ?? null), unrelated: localStorage.getItem("unrelated-origin-state") }; });
    assert(cleared.app.every((value) => value === null) && cleared.unrelated === "keep", "Harness clear action crossed the application-owned storage boundary.");

    await page.getByRole("button", { name: "Load Aurelia" }).click();
    await page.getByRole("link", { name: "Open Generate Profile" }).click();
    await page.waitForURL(`${baseUrl}/generate`);
    await page.getByText("Choose a template family").waitFor();
    const visualChoice = page.locator("button").filter({ hasText: "Visual / Portfolio" }).first();
    assert(await visualChoice.isEnabled() && await visualChoice.getByText(/AI recommended/i).isVisible(), "Normal Aurelia did not restore an eligible Visual recommendation.");
    assert(await page.locator('img[alt="Riverside Residence"]').count() > 0, "Normal Aurelia did not restore the canonical project image.");
    assert(await page.getByRole("button", { name: "Download PDF" }).first().isEnabled(), "Normal Aurelia export was not ready from canonical source state.");
    const normalState = await snapshot(); const normalLogoState = { companyLogo: normalState.company.logoUrl, profileLogo: normalState.generated.logoUrl };
    assert(normalLogoState.companyLogo === "" && normalLogoState.profileLogo === "" && await page.locator('img[alt="Aurelia Interiors logo"]').count() === 0, "A project image must not be promoted into the company-logo slot.");

    await page.goto(`${baseUrl}/beta-test`);
    await page.getByRole("button", { name: "Load missing-image case" }).click();
    const missingStorage = await page.evaluate(() => { const workspace = JSON.parse(localStorage.getItem("workspaceData") || "null"); const profile = workspace?.profiles?.find((entry) => entry.id === workspace.activeProfileId) || workspace?.profiles?.[0]; const state = profile?.state || {}; const appKeys = ["companyData", "projectsData", "profileStructure", "generatedProfile", "authoredFamilyDecision", "exportDecision"]; return { keys: Object.keys(localStorage).sort(), company: JSON.parse(state.companyData || "null"), projects: JSON.parse(state.projectsData || "[]"), derived: appKeys.filter((key) => !["companyData", "projectsData"].includes(key)).map((key) => ({ key, value: state[key] || null })) }; });
    assert(missingStorage.projects.length === 1 && !missingStorage.projects[0].imageUrl.startsWith("data:image/"), "Actual beta click did not persist the invalid canonical project image.");
    assert(missingStorage.company.logoUrl === "" && missingStorage.derived.every((entry) => !entry.value?.includes("data:image/")), "Actual beta click left a valid project image in a derived or logo state.");
    await page.getByRole("link", { name: "Open Generate Profile" }).click();
    await page.waitForURL(`${baseUrl}/generate`);
    await page.getByText("Choose a template family").waitFor();
    const missingState = await snapshot();
    assert(missingState.projects.length === 1 && !missingState.projects[0].imageUrl.startsWith("data:image/"), "Missing-image preset restored a valid source image.");
    const missingVisualChoice = page.locator("button").filter({ hasText: "Visual / Portfolio" }).first();
    assert(await missingVisualChoice.count() === 1 && await missingVisualChoice.isDisabled(), "Missing-image state left Visual eligible.");
    assert(await page.locator('img[alt="Riverside Residence"]').count() === 0, "Missing-image state rendered a Riverside project image element.");
    assert(await page.getByRole("button", { name: "Download PDF" }).first().isDisabled(), "Missing-image state left PDF export enabled.");
    assert(await page.getByText(/PDF export is blocked until each saved project has a valid PNG or JPEG image/).isVisible(), "Missing-image state lacks an actionable customer-safe message.");
    await page.reload();
    await page.getByText(/PDF export is blocked until each saved project/).waitFor();
    assert(await page.getByRole("button", { name: "Download PDF" }).first().isDisabled(), "Reload restored export readiness for the missing-image state.");
    assert(await page.locator('img[alt="Riverside Residence"]').count() === 0, "Reload resurrected a Riverside project image element for the missing-image state.");

    await page.goto(`${baseUrl}/beta-test`);
    await page.getByRole("button", { name: "Load Aurelia" }).click();
    await page.getByRole("link", { name: "Open Generate Profile" }).click();
    await page.waitForURL(`${baseUrl}/generate`);
    await page.getByText("Choose a template family").waitFor();
    await page.evaluate(() => { const workspace = JSON.parse(localStorage.getItem("workspaceData")); const profile = workspace.profiles.find((entry) => entry.id === workspace.activeProfileId) || workspace.profiles[0]; const source = JSON.parse(profile.state.projectsData); source[0].imageUrl = "corrupt://removed-after-generation"; profile.state.projectsData = JSON.stringify(source); localStorage.setItem("workspaceData", JSON.stringify(workspace)); });
    await page.reload();
    assert(await page.locator('img[src^="data:image/"]').count() === 0, "Stale generated profile resurrected the removed project image after reload.");
    await page.getByText(/saved profile is out of date|PDF export is blocked/).waitFor();
    assert(await page.getByText(/saved profile is out of date|PDF export is blocked/).count() > 0, "Stale source-image state did not remain safely blocked.");

    await page.evaluate(() => { const workspace = JSON.parse(localStorage.getItem("workspaceData")); const profile = workspace.profiles.find((entry) => entry.id === workspace.activeProfileId) || workspace.profiles[0]; profile.state.companyData = "{malformed"; localStorage.setItem("workspaceData", JSON.stringify(workspace)); });
    await page.goto(`${baseUrl}/company`);
    await page.getByText("Saved company information could not be read.").waitFor();
    assert(await page.getByRole("heading", { name: "Company Information" }).isVisible(), "Malformed storage caused a blank or crashed Company page.");
  }
  const companyResponse = await page.goto(`${baseUrl}/company`); const generateResponse = await page.goto(`${baseUrl}/generate`);
  assert(companyResponse?.status() === 200 && generateResponse?.status() === 200, "Normal production pages did not remain available.");
  for (const value of ["", "0", "1", "12"]) {
    await page.goto(`${baseUrl}/company`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('input[placeholder^="e.g. ElShaarawy"]').fill("Experience validation");
    await page.locator('textarea[placeholder="Tell us about the company..."]').fill("Production browser validation fixture.");
    if (value) await page.locator('input[type="number"]').fill(value);
    await page.getByRole("button", { name: "Save Company" }).click({ noWaitAfter: true });
    await page.waitForURL(`${baseUrl}/generate`);
  }
  await page.goto(`${baseUrl}/company`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('input[placeholder^="e.g. ElShaarawy"]').fill("Experience validation");
  await page.locator('textarea[placeholder="Tell us about the company..."]').fill("Production browser validation fixture.");
  await page.locator('input[type="number"]').fill("-2");
  await page.getByRole("button", { name: "Save Company" }).click();
  assert(await page.getByText("Years of Experience must be 0 or greater.").isVisible(), "Negative experience did not show the application validation message.");
  assert(new URL(page.url()).pathname === "/company", "Negative experience was not rejected by the Company Data form.");
  await browser.close(); console.log(`Beta QA harness production-browser test passed with flag ${enabled ? "on" : "off"}.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
