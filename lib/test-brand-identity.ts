import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const layout = read("app/layout.tsx");
const home = read("app/page.tsx");
const homepageShowcase = read("app/components/homepage-showcase.tsx");
const wordmark = read("app/components/lnkdit-wordmark.tsx");
const header = read("app/components/lnkdit-header.tsx");
const icon = read("app/icon.svg");
const auth = read("app/auth/page.tsx");
const workflowRoutes = ["app/company/page.tsx", "app/projects/page.tsx", "app/generate/page.tsx", "app/settings/page.tsx", "app/privacy/page.tsx", "app/terms/page.tsx", "app/workspace/page.tsx"].map(read);

assert(layout.includes("LNKDIT — Professional Company Profiles, Made Easier"));
assert(layout.includes("applicationName: \"LNKDIT\""));
assert(layout.includes("/icon.svg"));
assert(homepageShowcase.includes("Professional company profiles, made easier."));
assert(homepageShowcase.includes("Create, refine, and export a polished company profile in one place."));
assert(homepageShowcase.includes('href="/workspace"') && homepageShowcase.includes("View workspace"));
assert(wordmark.includes('text-slate-950">LNKD</span><span className="text-cyan-500">IT'));
assert(wordmark.includes("LnkditMark"));
assert(header.includes('<LnkditWordmark size="header" />'));
assert(wordmark.includes('"text-[1.15rem] tracking-[-0.045em]"'));
assert(workflowRoutes.every((route) => route.includes("LnkditHeader")));
assert(icon.includes("<svg") && icon.includes("#0F172A") && icon.includes("#22D3EE") && icon.includes("#FFFFFF"));
assert(icon.includes("<circle") && icon.includes('fill="#22D3EE"'));
assert(icon.includes('fill="#22D3EE"') && icon.includes("c0-2.8-2.2-5-5-5"));
assert(!icon.includes('d="M45 27v23"') && !icon.includes('stroke="#22D3EE"'));
assert(wordmark.includes('src="/icon.svg"'));
assert(homepageShowcase.includes("LnkditMark") && !homepageShowcase.includes("MiniLogo"));
assert(!icon.includes("M35 32h12") && !wordmark.includes("M27 25H35"));
assert(auth.includes("Sign in to LNKDIT"));
assert(!layout.includes("AI Company Profile"));
assert(!home.includes("AI Company Profile"));
assert(!homepageShowcase.includes("AI Company Profile"));

console.log("LNKDIT brand identity and route-surface tests passed.");
