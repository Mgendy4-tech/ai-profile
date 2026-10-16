import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routes = [
  "analyze-brand",
  "analyze-structure",
  "generate-profile",
  "plan-pdf-layout",
  "visual-direction",
];

for (const route of routes) {
  const source = readFileSync(resolve("app", "api", route, "route.ts"), "utf8");
  assert(!/const\s+client\s*=\s*new\s+OpenAI\s*\(/.test(source),
    `${route} must not instantiate OpenAI at module scope: it breaks credential-free Preview builds.`);
  assert(source.includes("const createOpenAIClient = () => new OpenAI("),
    `${route} must initialize the OpenAI client lazily at request time.`);
  assert(source.includes("createOpenAIClient().responses.create("),
    `${route} must call OpenAI through the request-time factory.`);
}
console.log("OpenAI clients initialize at request time, not at build time.");
