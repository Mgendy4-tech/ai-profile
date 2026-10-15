/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("playwright-core");

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3108").replace(/\/$/, "");
const email = process.env.SUPABASE_TEST_ACCOUNT_A_EMAIL;
const password = process.env.SUPABASE_TEST_ACCOUNT_A_PASSWORD;
const executablePath = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const assertNoRecoveryForm = async (page, label) => {
  assert(await page.getByRole("heading", { name: "Choose a new password", exact: true }).count() === 0, `${label}: unverified URL exposed the recovery heading.`);
  assert(await page.getByRole("button", { name: "Update password", exact: true }).count() === 0, `${label}: unverified URL exposed the password update action.`);
  assert((await page.getByText(/open the password-reset link from your email/i).count()) > 0, `${label}: missing recovery guidance.`);
};

(async () => {
  let browser;
  try {
    if (!email || !password) throw new Error("Disposable Account A credentials are not configured locally.");
    browser = await chromium.launch({ executablePath, headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(String(error)));

    await page.goto(`${baseUrl}/auth`, { waitUntil: "networkidle", timeout: 30000 });
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForTimeout(2500);
    assert(await page.getByText("Your workspace is account-ready", { exact: true }).count() > 0, "Disposable Account A did not sign in for the guard test.");

    await page.goto(`${baseUrl}/auth?mode=reset`, { waitUntil: "networkidle", timeout: 30000 });
    await assertNoRecoveryForm(page, "authenticated direct reset URL");
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await page.waitForTimeout(500);

    await page.goto(`${baseUrl}/auth?mode=reset`, { waitUntil: "networkidle", timeout: 30000 });
    await assertNoRecoveryForm(page, "signed-out missing token");
    await page.goto(`${baseUrl}/auth?mode=reset#error=access_denied&error_code=otp_expired&error_description=expired`, { waitUntil: "networkidle", timeout: 30000 });
    await assertNoRecoveryForm(page, "signed-out expired/invalid token");
    assert(errors.length === 0, `Password recovery guard browser errors: ${JSON.stringify(errors)}`);
    console.log("Password recovery browser guard passed for authenticated, signed-out, missing, expired, and invalid-token URLs.");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await browser?.close();
  }
})();
