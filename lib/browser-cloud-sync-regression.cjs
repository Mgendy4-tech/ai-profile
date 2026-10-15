const { chromium } = require("playwright-core");

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const baseUrl = (process.env.CLOUD_BROWSER_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const executablePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const projectRef = "cloud-sync-test";
const authStorageKey = `sb-${projectRef}-auth-token`;
const session = {
  access_token: "browser-test-access-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "browser-test-refresh-token",
  user: { id: "browser-test-user", aud: "authenticated", role: "authenticated", email: "cloud-test@example.com", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: {}, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
};
const workspace = {
  version: 1,
  activeProfileId: "profile_cloud_test",
  profiles: [{ id: "profile_cloud_test", displayName: "Cloud Test", createdAt: Date.now(), updatedAt: Date.now(), state: { companyData: JSON.stringify({ name: "Cloud Test", about: "A persisted cloud test workspace." }) } }],
};

(async () => {
  const browser = await chromium.launch({ executablePath, headless: true });
  const context = await browser.newContext(process.env.QA_FIXTURE_HEADER ? { extraHTTPHeaders: { "x-lnkdit-qa-fixture": process.env.QA_FIXTURE_HEADER } } : {});
  await context.addInitScript(({ key, auth, initialWorkspace }) => {
    localStorage.setItem(key, JSON.stringify(auth));
    localStorage.setItem("workspaceData", JSON.stringify(initialWorkspace));
  }, { key: authStorageKey, auth: session, initialWorkspace: workspace });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(120000);
  await context.route("https://cloud-sync-test.supabase.co/**", async (route) => {
    if (route.request().url().includes("/auth/v1/token")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session) });
    if (route.request().url().includes("/auth/v1/user")) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(session.user) });
    return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "not_found" }) });
  });
  const counts = { GET: 0, PUT: 0 };
  let cloudWorkspace = null;
  let failNextMethod = null;
  await page.route(`${baseUrl}/api/cloud/workspace`, async (route) => {
    const method = route.request().method();
    counts[method] = (counts[method] ?? 0) + 1;
    if (failNextMethod === method) { failNextMethod = null; return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, code: "cloud_unavailable" }) }); }
    if (method === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, workspace: cloudWorkspace }) });
    cloudWorkspace = JSON.parse(route.request().postData() || "null");
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, warnings: [] }) });
  });

  await page.goto(`${baseUrl}/auth`);
  await page.getByLabel("Email").fill(session.user.email);
  await page.getByLabel("Password").fill("browser-test-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByText("Synced", { exact: true }).first().waitFor({ timeout: 10000 });
  assert(counts.GET === 1 && counts.PUT === 1, `Initial migration must use one GET and one PUT. Counts=${JSON.stringify(counts)}`);
  await page.goto(`${baseUrl}/workspace`);
  await page.getByText("Synced", { exact: true }).first().waitFor({ timeout: 10000 });
  const initialCounts = { ...counts };
  await page.waitForTimeout(22000);
  assert(counts.GET === initialCounts.GET && counts.PUT === initialCounts.PUT, `Stable sync must not storm requests. Counts=${JSON.stringify(counts)}`);

  await page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem("workspaceData"));
    value.profiles[0].displayName = "Cloud Test Updated";
    localStorage.setItem("workspaceData", JSON.stringify(value));
    window.dispatchEvent(new Event("workspace-state-changed"));
  });
  await page.waitForTimeout(1500);
  assert(counts.PUT === initialCounts.PUT + 1, `One local update must use one follow-up PUT. Counts=${JSON.stringify(counts)}`);
  await page.reload();
  await page.getByText("Synced", { exact: true }).first().waitFor({ timeout: 10000 });
  const afterReload = { ...counts };
  await page.waitForTimeout(1500);
  assert(counts.GET === afterReload.GET && counts.PUT === afterReload.PUT, `Reload hydration must not echo an identical payload. Counts=${JSON.stringify(counts)}`);

  failNextMethod = "PUT";
  await page.evaluate(() => {
    const value = JSON.parse(localStorage.getItem("workspaceData"));
    value.profiles[0].displayName = "Cloud Test Failure Recovery";
    localStorage.setItem("workspaceData", JSON.stringify(value));
    window.dispatchEvent(new Event("workspace-state-changed"));
  });
  await page.getByRole("status").filter({ hasText: "Sync failed" }).first().waitFor({ timeout: 10000 });
  assert(JSON.parse(await page.evaluate(() => localStorage.getItem("workspaceData"))).profiles[0].displayName === "Cloud Test Failure Recovery", "Local workspace must survive cloud failure.");
  await page.getByRole("button", { name: "Retry" }).click();
  await page.getByText("Synced", { exact: true }).first().waitFor({ timeout: 10000 });
  assert(counts.PUT === afterReload.PUT + 2, `Failure and Retry must settle with one failed request and one retry. Counts=${JSON.stringify(counts)}`);

  await browser.close();
  console.log(`Cloud browser regression passed: authenticated hydration, 20s stability, bounded request counts (${JSON.stringify(counts)}), reload, failure preservation, and Retry.`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
