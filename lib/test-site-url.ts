import assert from "node:assert/strict";
import { passwordRecoveryRedirect } from "./site-url";

assert.equal(passwordRecoveryRedirect("https://ai-profile-jade.vercel.app"), "https://ai-profile-jade.vercel.app/auth?mode=reset");
assert.equal(passwordRecoveryRedirect("https://profile.example.com/"), "https://profile.example.com/auth?mode=reset");
assert(!passwordRecoveryRedirect("https://profile.example.com").includes("vercel.app"));
console.log("Current-origin password recovery redirect tests passed.");
