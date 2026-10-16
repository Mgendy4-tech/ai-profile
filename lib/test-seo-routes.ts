import assert from "node:assert/strict";
import robots from "../app/robots";
import sitemap from "../app/sitemap";

const canonical = "https://www.lnkdit.com";
const policy = robots();
assert.equal(policy.sitemap, `${canonical}/sitemap.xml`);
assert.equal(policy.host, canonical);
assert(!Array.isArray(policy.rules), "Use a single explicit crawler policy.");
assert.equal(policy.rules.userAgent, "*");
for (const path of ["/auth", "/workspace", "/company", "/projects", "/generate", "/export", "/beta-test", "/api/"]) {
  assert(policy.rules.disallow?.includes(path), `Private path ${path} must not be offered for indexing.`);
}
const entries = sitemap();
assert.deepEqual(entries.map((entry) => entry.url), [canonical, `${canonical}/privacy`, `${canonical}/terms`]);
assert(entries.every((entry) => entry.url.startsWith(canonical)), "Sitemap must use canonical HTTPS domain.");
console.log("Public sitemap and private-route robots policy passed.");
