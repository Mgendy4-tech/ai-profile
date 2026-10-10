const { chromium } = require("playwright-core");
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const authConfigured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}/workspace`);
  await page.waitForTimeout(500);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(500);
  assert(await page.getByText("Local only").isVisible(), "Guest workspace must remain available locally.");
  await page.getByRole("button", { name: "New Profile" }).click();
  await page.waitForURL(`${baseUrl}/company`);
  await page.goto(`${baseUrl}/workspace`);
  await page.waitForTimeout(500);
  assert((await page.locator("article").count()) === 2, "Guest profile creation must persist locally.");
  await browser.close();
  console.log(`Guest local persistence passed. Cloud browser scenarios ${authConfigured ? "require configured test credentials and were not auto-submitted" : "blocked: Supabase Preview environment is not configured"}.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
