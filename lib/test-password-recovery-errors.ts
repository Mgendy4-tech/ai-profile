import assert from "node:assert/strict";
import { authFailureCode, customerAuthError } from "./auth-messages";

const cases = [
  ["weak_password", "password_policy_rejected", "Choose a stronger password and try again."],
  ["same_password", "password_same_as_current", "Choose a different password than your current password."],
  ["session_not_found", "recovery_session_invalid", "This recovery link has expired or is no longer valid. Request a new password-reset email."],
  ["otp_expired", "recovery_token_invalid", "This recovery link has expired or is no longer valid. Request a new password-reset email."],
  ["reauthentication_needed", "reauthentication_required", "For security, request a new password-reset email and try again."],
  ["over_request_rate_limit", "auth_rate_limited", "Too many attempts. Wait a few minutes, then request a new password-reset email."],
] as const;

for (const [providerCode, expectedCode, expectedMessage] of cases) {
  const error = { code: providerCode, message: `provider detail for ${providerCode}` };
  assert.equal(authFailureCode(error, "reset-password"), expectedCode, `${providerCode} must map to a safe observability code.`);
  assert.equal(customerAuthError(error, "reset-password"), expectedMessage, `${providerCode} must map to a customer-safe message.`);
  assert(!customerAuthError(error, "reset-password").includes("provider detail"), `${providerCode} leaked provider detail.`);
}

console.log("Password recovery failure classification tests passed without exposing provider details.");
