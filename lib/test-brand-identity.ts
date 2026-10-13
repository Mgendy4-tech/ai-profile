import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const layout = read("app/layout.tsx");
const home = read("app/page.tsx");
const wordmark = read("app/components/lnkdit-wordmark.tsx");
const icon = read("app/icon.svg");
const auth = read("app/auth/page.tsx");

assert(layout.includes("LNKDIT — Professional Company Profiles, Made Easier"));
assert(layout.includes("applicationName: \"LNKDIT\""));
assert(layout.includes("/icon.svg"));
assert(home.includes("Professional company profiles, made easier."));
assert(home.includes("Create, refine, and export a polished company profile in one place."));
assert(wordmark.includes("LNKDIT"));
assert(icon.includes("<svg") && icon.includes("#67e8f9"));
assert(auth.includes("Sign in to LNKDIT"));
assert(!layout.includes("AI Company Profile"));
assert(!home.includes("AI Company Profile"));

console.log("LNKDIT brand identity and route-surface tests passed.");
