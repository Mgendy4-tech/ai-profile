"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium, webkit } = require("playwright-core");

const baseUrl = process.argv[2] || "http://localhost:3108";
const chromePath = process.env.CHROME_PATH || (process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : chromium.executablePath());
const screenshotDir = path.join(os.tmpdir(), `lnkdit-homepage-responsive-${Date.now()}`);
fs.mkdirSync(screenshotDir, { recursive: true });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function inspectPage(page) {
  return page.evaluate(() => {
    const visible = (node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.01 && rect.width > 0 && rect.height > 0;
    };
    const rectFor = (node) => {
      const rect = node.getBoundingClientRect();
      return { left: Math.round(rect.left), right: Math.round(rect.right), top: Math.round(rect.top), bottom: Math.round(rect.bottom), width: Math.round(rect.width), height: Math.round(rect.height) };
    };
    const revealNodes = [...document.querySelectorAll("[data-home-reveal]")];
    const sections = [...document.querySelectorAll(".home-page-shell section")];
    const cardNodes = [...document.querySelectorAll(".home-floating-card")];
    const cards = cardNodes.filter(visible).map((node) => ({ role: [...node.classList].find((name) => name !== "home-floating-card" && name.startsWith("home-floating-")), ...rectFor(node) }));
    const cardByRole = (role) => cards.find((card) => card.role === role);
    const workspace = cardByRole("home-floating-workspace");
    const profile = cardByRole("home-floating-profile");
    const refinement = cardByRole("home-floating-refinement");
    const exportCard = cardByRole("home-floating-export");
    const exportNode = document.querySelector(".home-floating-export");
    const exportRect = exportNode ? exportNode.getBoundingClientRect() : null;
    const exportContent = exportNode ? [...exportNode.querySelectorAll("p, button, .home-pdf-sheet")].filter(visible).map((node) => rectFor(node)) : [];
    const downloadButton = exportNode?.querySelector("button");
    const downloadButtonRect = downloadButton && visible(downloadButton) ? rectFor(downloadButton) : null;
    const within = (child, parent) => child && parent && child.left >= parent.left - 1 && child.right <= parent.right + 1 && child.top >= parent.top - 1 && child.bottom <= parent.bottom + 1;
    const header = document.querySelector(".home-hero header");
    const headerRect = header ? rectFor(header) : null;
    const authHeader = document.querySelector(".home-site-header");
    const authFloating = document.querySelector(".auth-floating-panel");
    const authHeaderRect = authHeader ? rectFor(authHeader) : null;
    const authFloatingRect = authFloating ? rectFor(authFloating) : null;
    const heroCopy = document.querySelector(".home-hero [data-home-reveal]");
    const profilePreview = document.querySelector(".home-floating-profile > .home-preview-card");
    const profileImage = document.querySelector(".home-floating-profile .home-profile-image");
    const profileFooter = profilePreview?.querySelector(".home-profile-body > :last-child");
    const heroCopyRect = heroCopy ? rectFor(heroCopy) : null;
    const profilePreviewRect = profilePreview ? rectFor(profilePreview) : null;
    const profileImageRect = profileImage ? rectFor(profileImage) : null;
    const profileFooterRect = profileFooter ? rectFor(profileFooter) : null;
    const workspacePreview = document.querySelector(".home-floating-workspace > .home-preview-card");
    const workspaceContent = document.querySelector(".home-floating-workspace .home-workspace-card-content");
    const workspacePreviewRect = workspacePreview ? rectFor(workspacePreview) : null;
    const workspaceContentRect = workspaceContent ? rectFor(workspaceContent) : null;
    const profileSlogan = document.querySelector(".home-floating-profile .home-profile-slogan");
    const profileAccent = document.querySelector(".home-floating-profile .home-profile-accent");
    const profileSloganRect = profileSlogan ? rectFor(profileSlogan) : null;
    const profileAccentRect = profileAccent ? rectFor(profileAccent) : null;
    const heroHeading = document.querySelector(".home-hero h1");
    const heroEyebrow = document.querySelector(".home-hero p.inline-flex");
    const headingRect = heroHeading ? rectFor(heroHeading) : null;
    const eyebrowRect = heroEyebrow ? rectFor(heroEyebrow) : null;
    const intersects = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const overlapCount = cards.reduce((count, card, index) => count + cards.slice(index + 1).filter((other) => intersects(card, other)).length, 0);
    return {
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      revealCount: revealNodes.length,
      hiddenRevealCount: revealNodes.filter((node) => !visible(node)).length,
      sectionCount: sections.length,
      hiddenSectionCount: sections.filter((node) => !visible(node)).length,
      clippedCardCount: cards.filter((rect) => rect.left < -1 || rect.right > window.innerWidth + 1).length,
      cards,
      cardGeometry: { workspace, profile, refinement, exportCard, mobileSupportEqual: Boolean(workspace && exportCard && Math.max(Math.abs(workspace.width - exportCard.width), Math.abs(workspace.height - exportCard.height)) <= 2), supportWidthsEqual: Boolean(workspace && refinement && exportCard && Math.max(Math.abs(workspace.width - refinement.width), Math.abs(workspace.width - exportCard.width)) <= 2), profileTopAligned: Boolean(profile && workspace && Math.abs(profile.top - workspace.top) <= 2), profileBottomAligned: Boolean(profile && exportCard && Math.abs(profile.bottom - exportCard.bottom) <= 2), supportGapsAligned: Boolean(workspace && refinement && exportCard && Math.abs((refinement.top - workspace.bottom) - (exportCard.top - refinement.bottom)) <= 2), profileHeightMatchesSupportStack: Boolean(profile && workspace && refinement && exportCard && Math.abs(profile.height - (workspace.height + refinement.height + exportCard.height + (refinement.top - workspace.bottom) + (exportCard.top - refinement.bottom))) <= 2), rightColumnAligned: Boolean(workspace && refinement && exportCard && Math.abs(workspace.left - refinement.left) <= 2 && Math.abs(workspace.right - refinement.right) <= 2), profileLeft: Boolean(profile && workspace && profile.left < workspace.left), mobileOrder: Boolean(profile && workspace && exportCard && profile.top < workspace.top && workspace.top < exportCard.top), compositionHeight: profile?.height ?? null, compositionHeightCompact: Boolean(profile && (profile.height >= 500 && profile.height <= 600)), copyCompositionBottomGap: Boolean(heroCopyRect && profile && Math.abs(profile.bottom - heroCopyRect.bottom) <= 96), profileImageVisible: Boolean(profileImageRect && profileImageRect.width > 0 && profileImageRect.height > 0), profileSloganVisible: Boolean(profileSloganRect && profileSloganRect.width > 0 && profileSloganRect.height > 0), profileAccentVisible: Boolean(profileAccentRect && profileAccentRect.width > 0 && profileAccentRect.height > 0), profileFooterBottomGap: profilePreviewRect && profileFooterRect ? profilePreviewRect.bottom - profileFooterRect.bottom : null, profileContentCompact: Boolean(profilePreviewRect && profileFooterRect && profilePreviewRect.bottom - profileFooterRect.bottom <= 32), workspaceContentWithinCard: Boolean(workspacePreviewRect && workspaceContentRect && within(workspaceContentRect, workspacePreviewRect)), backingSurfacePresent: Boolean(document.querySelector(".home-stage-grid, .home-product-surface")), exportContentVisible: Boolean(exportRect && exportContent.length > 0 && exportContent.every((child) => within(child, rectFor(exportNode)))), downloadButtonVisible: Boolean(downloadButtonRect), exportParentNotClipping: Boolean(exportNode && getComputedStyle(exportNode).overflow !== "hidden"), headerCardSeparation: Boolean(headerRect && cards.every((card) => card.top >= headerRect.bottom - 1)), authHeaderPosition: authHeader ? getComputedStyle(authHeader).position : null, authSignInVisible: Boolean(document.querySelector('.home-site-header a[href="/auth"]') && visible(document.querySelector('.home-site-header a[href="/auth"]'))), authFloatingPresent: Boolean(authFloating), authFloatingPosition: authFloating ? getComputedStyle(authFloating).position : null, overlapCount, topAlignmentOffset: eyebrowRect && cards.length ? Math.min(...cards.map((card) => card.top)) - eyebrowRect.top : null, heroCardIntersection: Boolean(headingRect && cards.some((card) => intersects(card, headingRect))) },
      authGeometry: { header: authHeaderRect, floating: authFloatingRect },
      scrollHeight: document.documentElement.scrollHeight,
    };
  });
}

function assertHealthy(state, label) {
  const failures = [];
  if (state.scrollWidth > state.viewportWidth + 1) failures.push(`horizontal overflow ${state.scrollWidth}>${state.viewportWidth}`);
  if (state.hiddenRevealCount > 0) failures.push(`${state.hiddenRevealCount}/${state.revealCount} reveal nodes are not visible`);
  if (state.hiddenSectionCount > 0) failures.push(`${state.hiddenSectionCount}/${state.sectionCount} homepage sections are not visible`);
  if (state.clippedCardCount > 0) failures.push(`${state.clippedCardCount} product cards are horizontally clipped`);
  if (state.cardGeometry.heroCardIntersection) failures.push("product card intersects hero headline");
  if (state.cardGeometry.authFloatingPresent) failures.push("homepage still renders floating auth panel");
  if (state.cardGeometry.authHeaderPosition === "fixed" || state.cardGeometry.authHeaderPosition === "sticky") failures.push(`header auth panel uses ${state.cardGeometry.authHeaderPosition} positioning`);
  if (!state.cardGeometry.authSignInVisible) failures.push("homepage does not expose a visible Sign in entry");
  if (state.cardGeometry.overlapCount > 0) failures.push(`${state.cardGeometry.overlapCount} product cards overlap`);
  if (state.viewportWidth >= 1200 && Math.abs(state.cardGeometry.topAlignmentOffset ?? 999) > 24) failures.push(`hero top alignment offset ${state.cardGeometry.topAlignmentOffset}px exceeds 24px`);
  if (state.viewportWidth >= 1200 && (!state.cardGeometry.profileTopAligned || !state.cardGeometry.profileBottomAligned || !state.cardGeometry.supportGapsAligned || !state.cardGeometry.supportWidthsEqual || !state.cardGeometry.profileHeightMatchesSupportStack || !state.cardGeometry.rightColumnAligned || !state.cardGeometry.profileLeft || !state.cardGeometry.compositionHeightCompact || !state.cardGeometry.copyCompositionBottomGap || !state.cardGeometry.profileImageVisible || !state.cardGeometry.profileSloganVisible || !state.cardGeometry.profileAccentVisible || !state.cardGeometry.workspaceContentWithinCard || state.cardGeometry.backingSurfacePresent || !state.cardGeometry.profileContentCompact || !state.cardGeometry.exportContentVisible || !state.cardGeometry.downloadButtonVisible || !state.cardGeometry.exportParentNotClipping || !state.cardGeometry.headerCardSeparation)) failures.push(`desktop card geometry mismatch ${JSON.stringify(state.cardGeometry)}`);
  if (state.viewportWidth <= 480 && (!state.cardGeometry.mobileOrder || !state.cardGeometry.mobileSupportEqual)) failures.push(`mobile card order/size mismatch ${JSON.stringify(state.cardGeometry)}`);
  if (failures.length) throw new Error(`${label}: ${failures.join("; ")}`);
}

async function runCase(browser, engine, width, reducedMotion) {
  const height = width === 390 ? 844 : width === 430 ? 932 : 900;
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  if (reducedMotion) await page.emulateMedia({ reducedMotion: "reduce" });

  const suffix = reducedMotion ? "-reduced-motion" : "";
  const label = `${engine}-${width}${suffix}`;
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await wait(250);
  const initial = await inspectPage(page);
  assertHealthy(initial, `${label} initial`);

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await wait(100);
  const scrolledAuth = await page.evaluate(() => {
    const node = document.querySelector(".home-site-header");
    const rect = node?.getBoundingClientRect();
    return { position: node ? getComputedStyle(node).position : null, top: rect?.top ?? null, viewportHeight: window.innerHeight };
  });
  if (scrolledAuth.position === "fixed" || scrolledAuth.position === "sticky" || (scrolledAuth.top !== null && scrolledAuth.top >= scrolledAuth.viewportHeight)) {
    throw new Error(`${label} homepage header did not scroll away naturally ${JSON.stringify(scrolledAuth)}`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(100);

  for (let y = 0; y <= initial.scrollHeight; y += Math.max(240, Math.floor(height * 0.8))) {
    await page.evaluate((scrollY) => window.scrollTo(0, scrollY), y);
    await wait(80);
    assertHealthy(await inspectPage(page), `${label} scroll ${y}`);
  }

  const fullPagePath = path.join(screenshotDir, `${label}.png`);
  await page.screenshot({ path: fullPagePath, fullPage: true });
  await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
  await wait(250);
  await page.evaluate(() => window.scrollTo(0, 0));
  await wait(100);
  const reloaded = await inspectPage(page);
  assertHealthy(reloaded, `${label} reload`);
  if (consoleErrors.length || pageErrors.length) throw new Error(`${label}: browser errors console=${JSON.stringify(consoleErrors.slice(0, 5))} page=${JSON.stringify(pageErrors.slice(0, 5))}`);
  await page.close();
  return { engine, width, height, reducedMotion, initial, reloaded, screenshot: fullPagePath, consoleErrors, pageErrors };
}

async function main() {
  let chromiumBrowser;
  let webkitBrowser;
  try {
    chromiumBrowser = await chromium.launch({ headless: true, executablePath: chromePath });
    webkitBrowser = await webkit.launch({ headless: true });
  } catch (error) {
    if (chromiumBrowser) await chromiumBrowser.close();
    if (webkitBrowser) await webkitBrowser.close();
    console.error(JSON.stringify({ result: "BLOCKED", reason: String(error), screenshotDir }, null, 2));
    process.exitCode = 2;
    return;
  }

  const results = [];
  try {
    for (const width of [390, 430, 768, 1280, 1440, 1600]) results.push(await runCase(chromiumBrowser, "chromium", width, false));
    results.push(await runCase(chromiumBrowser, "chromium", 390, true));
    for (const width of [390, 430]) results.push(await runCase(webkitBrowser, "webkit", width, false));
    results.push(await runCase(webkitBrowser, "webkit", 390, true));
    console.log(JSON.stringify({ result: "PASS", screenshotDir, cases: results }, null, 2));
  } finally {
    await chromiumBrowser.close();
    await webkitBrowser.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ result: "FAIL", error: String(error), screenshotDir }, null, 2));
  process.exitCode = 1;
});
