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
assert(home.includes("home-product-surface") && home.includes("home-refinement-progress"));
assert(styles.includes(".home-floating-workspace { left: 1%; top: 12%; z-index: 1; width: 48%; transform: rotate(-.2deg)"));
assert(styles.includes(".home-floating-profile { right: 2%; top: 3%; z-index: 4; width: 69%; transform: rotate(.15deg)"));
assert(styles.includes(".home-floating-refinement { left: 27%; top: 56%; z-index: 5; width: 25%; transform: rotate(0deg)"));
assert(styles.includes(".home-floating-export { right: 3%; top: 56%; z-index: 5; width: 27%; transform: rotate(.35deg)"));
assert(styles.includes("home-floating-profile > .home-preview-card") && styles.includes("home-floating-workspace > .home-preview-card"));
assert(styles.includes(".home-product-surface") && styles.includes(".home-workspace-preview { min-height: 220px"));
assert(styles.includes("@media (min-width: 768px) and (max-width: 1199px)") && styles.includes(".home-product-stage { min-height: 700px; }"));
assert(styles.includes("@media (max-width: 480px)") && styles.includes("min-height: 760px") && styles.includes("top: 14%; width: 90%") && styles.includes(".home-floating-refinement { display: none; }") && styles.includes("top: 70%; width: 52%"));
assert(styles.includes("home-workflow-step-active"));
assert(styles.includes("home-pdf-page-front"));
assert(!home.includes("10,000") && !home.includes("testimonials"));

console.log("LNKDIT homepage design structure tests passed.");
