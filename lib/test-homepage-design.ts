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
assert(home.includes("home-product-surface") && home.includes("home-product-grid") && home.includes("home-refinement-rows"));
assert(styles.includes(".home-product-grid") && styles.includes("grid-template-columns: repeat(2, minmax(0, 1fr))") && styles.includes("grid-template-rows: repeat(3, minmax(0, var(--home-support-height)))"));
assert(styles.includes(".home-floating-workspace { grid-column: 1; grid-row: 1;"));
assert(styles.includes(".home-floating-profile { grid-column: 2; grid-row: 1 / span 2;"));
assert(styles.includes(".home-floating-refinement { grid-column: 1; grid-row: 2;"));
assert(styles.includes(".home-floating-export { grid-column: 2; grid-row: 3;"));
assert(styles.includes("home-floating-profile > .home-preview-card") && styles.includes("home-floating-workspace > .home-preview-card"));
assert(styles.includes(".home-product-surface") && styles.includes("--home-support-height: 240px"));
assert(styles.includes("@media (min-width: 768px) and (max-width: 1199px)") && styles.includes("--home-support-height: 220px"));
assert(styles.includes("@media (max-width: 480px)") && styles.includes(".home-floating-refinement { display: none; }") && styles.includes(".home-product-grid { position: relative; inset: auto; display: flex; flex-direction: column;"));
assert(styles.includes("home-workflow-step-active"));
assert(styles.includes("home-pdf-page-front"));
assert(!home.includes("10,000") && !home.includes("testimonials"));

console.log("LNKDIT homepage design structure tests passed.");
