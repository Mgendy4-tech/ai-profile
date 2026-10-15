/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright-core");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3108").replace(/\/$/, "");
const executablePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

(async () => {
  let browser;
  try {
  browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 30000 });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });

  assert(await page.getByRole("link", { name: "Sign in", exact: true }).isVisible(), "Mobile header does not expose Sign in.");
  assert(await page.getByText("Guest mode", { exact: true }).count() === 0, "Homepage still exposes Guest mode messaging.");
  assert(await page.getByText("Sign in to sync", { exact: true }).count() === 0, "Homepage still exposes the sync badge.");
  assert(await page.getByRole("link", { name: "View workspace", exact: true }).count() === 0, "Signed-out homepage exposes View workspace.");
  const createLinks = page.getByRole("link", { name: /Create your profile/ });
  assert(await createLinks.count() === 3, `Expected three account-gated Create your profile links, got ${await createLinks.count()}.`);
  for (let index = 0; index < await createLinks.count(); index += 1) {
    assert((await createLinks.nth(index).getAttribute("href")) === "/auth?next=%2Fcompany", `Create CTA ${index + 1} does not point to /auth?next=/company.`);
  }

  for (const route of ["/company", "/projects", "/generate", "/export", "/workspace"]) {
    await page.goto(`${baseUrl}${route}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    const url = new URL(page.url());
    assert(url.pathname === "/auth" && url.searchParams.get("next") === route, `${route} bypassed the unauthenticated auth gate: ${page.url()}`);
  }
  await page.goto(`${baseUrl}/beta-test`, { waitUntil: "domcontentloaded", timeout: 30000 });
  assert(new URL(page.url()).pathname === "/beta-test" || new URL(page.url()).pathname === "/", `Beta route did not resolve safely: ${page.url()}`);

  await page.goto(`${baseUrl}/auth?next=%2Fcompany`, { waitUntil: "networkidle", timeout: 30000 });
  assert(await page.getByRole("heading", { name: /Sign in or create your LNKDIT account/ }).isVisible(), "Auth page did not render the account-first heading.");
  assert(await page.getByRole("button", { name: "Sign in", exact: true }).isVisible(), "Auth page does not show the Sign in action.");
  assert(await page.getByRole("button", { name: "Create account", exact: true }).isVisible(), "Auth page does not show the Create account action.");
  assert(errors.length === 0, `Auth gate browser errors: ${JSON.stringify(errors)}`);
  console.log("Account-first browser gate passed for mobile CTA and direct-route protection.");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await browser?.close();
  }
})();
