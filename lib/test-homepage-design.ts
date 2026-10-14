import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const home = readFileSync("app/components/homepage-showcase.tsx", "utf8");
const page = readFileSync("app/page.tsx", "utf8");
const styles = readFileSync("app/globals.css", "utf8");

for (const section of [
  "how-it-works",
  "workspace",
  "Create",
  "Refine",
  "Export",
  "A useful first draft",
  "The finished profile",
  "Wherever the work takes you",
  "Ready when you are",
]) {
  assert(home.includes(section), `homepage design is missing: ${section}`);
}

assert(home.includes("Professional company profiles, made easier."));
assert(home.includes("Create your profile"));
assert(home.includes("View workspace"));
assert(home.includes("AURELIA STUDIO"));
assert(home.includes("Demo company profile preview"));
assert(home.includes("Demo PDF export panel"));
assert(home.includes("/homepage/aurelia-interior.webp"));
assert(home.includes("Before") && home.includes("Refine") && home.includes("After"));
assert(home.includes("home-pdf-stack") && home.includes("home-pdf-page-back-two"));
assert(home.includes("prefers-reduced-motion" ) || styles.includes("prefers-reduced-motion"));
assert(home.includes("HomepageShowcase"));
assert(page.includes("HomepageShowcase"));
assert(styles.includes("home-reveal-visible"));
assert(/\[data-home-reveal\]\s*\{\s*opacity:\s*1/.test(styles));
assert(!/\[data-home-reveal\]\s*\{\s*opacity:\s*0/.test(styles));
assert(styles.includes("home-floating-card"));
assert(home.includes("home-product-surface") && home.includes("home-product-grid") && home.includes("home-support-grid") && home.includes("home-refinement-rows"));
assert(home.includes("grid items-start gap-12") && styles.includes(".home-product-grid { position: relative; display: grid;"));
assert(styles.includes(".home-product-grid") && styles.includes("grid-template-columns: repeat(2, minmax(0, 1fr))") && styles.includes(".home-support-grid { display: grid; min-width: 0; grid-template-rows: repeat(3, var(--home-support-card-height));"));
assert(home.indexOf("home-floating-profile") < home.indexOf("home-support-grid"));
assert(home.indexOf("home-floating-workspace") < home.indexOf("home-floating-refinement") && home.indexOf("home-floating-refinement") < home.indexOf("home-floating-export"));
assert(styles.includes("home-floating-profile > .home-preview-card") && styles.includes("home-floating-workspace > .home-preview-card"));
assert(styles.includes(".home-product-surface") && styles.includes(".home-profile-body") && styles.includes("--home-support-gap: 24px"));
assert(styles.includes("--home-support-card-height: clamp"));
assert(styles.includes(".home-floating-profile > .home-preview-card { height: calc"));
assert(styles.includes(".home-profile-body > :last-child"));
assert(styles.includes(".home-export-preview"));
assert(!styles.includes(".home-support-grid { display: grid; height: 100%;"));
assert(!styles.includes("height: 768px"));
assert(styles.includes("@media (min-width: 768px) and (max-width: 1199px)") && styles.includes(".home-product-grid { margin-inline: 4%; }"));
assert(styles.includes("@media (max-width: 480px)") && styles.includes(".home-floating-refinement { display: none; }") && styles.includes(".home-product-grid { display: flex; flex-direction: column; gap: 24px; margin: 0; }") && styles.includes(".home-support-grid { display: contents; }"));
assert(!styles.includes(".home-product-stage { --home-support-gap: 20px; position: relative; min-height: 690px;") && !styles.includes(".home-preview-card { overflow: hidden;"));
assert(styles.includes("home-workflow-step-active"));
assert(styles.includes("home-pdf-page-front"));
assert(!home.includes("10,000") && !home.includes("testimonials"));

console.log("LNKDIT homepage design structure tests passed.");
