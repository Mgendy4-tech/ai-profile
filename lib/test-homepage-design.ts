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
assert(styles.includes("home-floating-profile") && styles.includes("width: 64%"));
assert(styles.includes("rotate(-2.5deg)") && styles.includes("rotate(1.5deg)"));
assert(styles.includes("home-workflow-step-active"));
assert(styles.includes("home-pdf-page-front"));
assert(!home.includes("10,000") && !home.includes("testimonials"));

console.log("LNKDIT homepage design structure tests passed.");
