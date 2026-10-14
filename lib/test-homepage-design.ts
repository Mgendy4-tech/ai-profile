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
assert(styles.includes("home-floating-card"));
assert(styles.includes(".home-floating-workspace { left: 4%; top: 16%; width: 36%; transform: rotate(-1.5deg)"));
assert(styles.includes(".home-floating-profile { right: 4%; top: 8%; z-index: 4; width: 60%; transform: rotate(.3deg)"));
assert(styles.includes(".home-floating-refinement { left: 9%; bottom: 8%; z-index: 2; width: 32%; transform: rotate(-.3deg)"));
assert(styles.includes(".home-floating-export { right: 5%; top: 70%; z-index: 3; width: 29%; transform: rotate(.7deg)"));
assert(styles.includes("home-floating-profile > .home-preview-card") && styles.includes("home-floating-workspace > .home-preview-card"));
assert(styles.includes("min-height: 1100px") && styles.includes("top: 2%; width: 74%") && styles.includes("top: 15%; width: 84%") && styles.includes("top: 56%; width: 74%") && styles.includes("top: 82%; width: 74%"));
assert(styles.includes("@media (max-width: 480px)") && styles.includes("min-height: 760px") && styles.includes("top: 18%; width: 86%") && styles.includes(".home-floating-refinement { display: none; }") && styles.includes("top: 73%; width: 56%"));
assert(styles.includes("home-workflow-step-active"));
assert(styles.includes("home-pdf-page-front"));
assert(!home.includes("10,000") && !home.includes("testimonials"));

console.log("LNKDIT homepage design structure tests passed.");
