"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { chromium, webkit } = require("playwright-core");

const baseUrl = process.argv[2] || "http://localhost:3108";
const chromePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
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
      cardGeometry: { workspace, profile, refinement, exportCard, mobileSupportEqual: Boolean(workspace && exportCard && Math.max(Math.abs(workspace.width - exportCard.width), Math.abs(workspace.height - exportCard.height)) <= 2), profileTopAligned: Boolean(profile && workspace && Math.abs(profile.top - workspace.top) <= 4), profileBottomAligned: Boolean(profile && exportCard && Math.abs(profile.bottom - exportCard.bottom) <= 4), supportGapsAligned: Boolean(workspace && refinement && exportCard && Math.abs((refinement.top - workspace.bottom) - (exportCard.top - refinement.bottom)) <= 3), supportHeightsOrdered: Boolean(workspace && refinement && exportCard && workspace.height > refinement.height && refinement.height > exportCard.height), rightColumnAligned: Boolean(workspace && refinement && exportCard && Math.abs(workspace.left - refinement.left) <= 2 && Math.abs(workspace.right - refinement.right) <= 2), profileLeft: Boolean(profile && workspace && profile.left < workspace.left), mobileOrder: Boolean(profile && workspace && exportCard && profile.top < workspace.top && workspace.top < exportCard.top), overlapCount, topAlignmentOffset: eyebrowRect && cards.length ? Math.min(...cards.map((card) => card.top)) - eyebrowRect.top : null, heroCardIntersection: Boolean(headingRect && cards.some((card) => intersects(card, headingRect))) },
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
  if (state.cardGeometry.overlapCount > 0) failures.push(`${state.cardGeometry.overlapCount} product cards overlap`);
  if (state.viewportWidth >= 1200 && Math.abs(state.cardGeometry.topAlignmentOffset ?? 999) > 24) failures.push(`hero top alignment offset ${state.cardGeometry.topAlignmentOffset}px exceeds 24px`);
  if (state.viewportWidth >= 1200 && (!state.cardGeometry.profileTopAligned || !state.cardGeometry.profileBottomAligned || !state.cardGeometry.supportGapsAligned || !state.cardGeometry.supportHeightsOrdered || !state.cardGeometry.rightColumnAligned || !state.cardGeometry.profileLeft)) failures.push(`desktop card geometry mismatch ${JSON.stringify(state.cardGeometry)}`);
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
  if (consoleErrors.length || pageErrors.length) throw new Error(`${label}: browser errors console=${consoleErrors.length} page=${pageErrors.length}`);
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
    for (const width of [390, 430, 768, 1280, 1440]) results.push(await runCase(chromiumBrowser, "chromium", width, false));
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
