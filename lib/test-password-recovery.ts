import assert from "node:assert/strict";
import { authFailureCode, customerAuthError } from "./auth-messages";

const recoveryMessage = customerAuthError({ code: "otp_expired", message: "raw Supabase token details" }, "reset-password");
assert.equal(recoveryMessage, "This recovery link has expired or is no longer valid. Request a new password-reset email.");
assert(!recoveryMessage.includes("raw Supabase"));
assert.equal(customerAuthError({ code: "invalid_token", message: "invalid token" }, "reset-password"), "This recovery link has expired or is no longer valid. Request a new password-reset email.");
assert.equal(customerAuthError({ message: "provider internal error" }, "reset-password"), "We could not update your password. The recovery link may have expired.");
assert.equal(authFailureCode({ code: "invalid_token" }, "reset-password"), "recovery_token_invalid");

console.log("Password recovery customer-error and failure-code tests passed.");
