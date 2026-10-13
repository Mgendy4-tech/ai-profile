import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const layout = read("app/layout.tsx");
const home = read("app/page.tsx");
const wordmark = read("app/components/lnkdit-wordmark.tsx");
const header = read("app/components/lnkdit-header.tsx");
const icon = read("app/icon.svg");
const auth = read("app/auth/page.tsx");
const workflowRoutes = ["app/company/page.tsx", "app/projects/page.tsx", "app/generate/page.tsx", "app/settings/page.tsx", "app/privacy/page.tsx", "app/terms/page.tsx", "app/workspace/page.tsx"].map(read);

assert(layout.includes("LNKDIT — Professional Company Profiles, Made Easier"));
assert(layout.includes("applicationName: \"LNKDIT\""));
assert(layout.includes("/icon.svg"));
assert(home.includes("Professional company profiles, made easier."));
assert(home.includes("Create, refine, and export a polished company profile in one place."));
assert(home.includes('href="/workspace"') && home.includes(">View workspace</Link>"));
assert(wordmark.includes('text-slate-950">LNKD</span><span className="text-cyan-500">IT'));
assert(wordmark.includes("LnkditMark"));
assert(header.includes("LnkditWordmark"));
assert(workflowRoutes.every((route) => route.includes("LnkditHeader")));
assert(icon.includes("<svg") && icon.includes("#0F172A") && icon.includes("#22D3EE") && icon.includes("#FFFFFF"));
assert(icon.includes("<circle") && icon.includes('fill="#22D3EE"'));
assert(wordmark.includes("<circle") && wordmark.includes('fill="#22D3EE"'));
assert(!icon.includes("M35 32h12") && !wordmark.includes("M27 25H35"));
assert(auth.includes("Sign in to LNKDIT"));
assert(!layout.includes("AI Company Profile"));
assert(!home.includes("AI Company Profile"));

console.log("LNKDIT brand identity and route-surface tests passed.");
