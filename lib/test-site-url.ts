import assert from "node:assert/strict";
import { passwordRecoveryRedirect, resolvePublicOrigin } from "./site-url";

assert.equal(passwordRecoveryRedirect("https://ai-profile-jade.vercel.app"), "https://ai-profile-jade.vercel.app/auth?mode=reset");
assert.equal(passwordRecoveryRedirect("https://profile.example.com/"), "https://profile.example.com/auth?mode=reset");
assert(!passwordRecoveryRedirect("https://profile.example.com").includes("vercel.app"));
assert.equal(passwordRecoveryRedirect("https://preview.example.vercel.app", "https://profile.example.com"), "https://preview.example.vercel.app/auth?mode=reset");
assert.equal(passwordRecoveryRedirect(undefined, "https://profile.example.com/"), "https://profile.example.com/auth?mode=reset");
assert.equal(passwordRecoveryRedirect("not-a-url", "javascript:alert(1)"), "/auth?mode=reset");
assert.equal(passwordRecoveryRedirect("https://profile.example.com/account", "https://fallback.example.com"), "https://fallback.example.com/auth?mode=reset");
assert.equal(resolvePublicOrigin("https://user:pass@example.com", "https://profile.example.com"), "https://profile.example.com");
assert.equal(resolvePublicOrigin("javascript:alert(1)", "https://profile.example.com"), "https://profile.example.com");
assert.equal(resolvePublicOrigin("not-a-url", "also-not-a-url"), null);
console.log("Canonical origin and password recovery redirect tests passed.");
