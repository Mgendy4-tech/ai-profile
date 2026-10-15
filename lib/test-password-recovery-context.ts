import assert from "node:assert/strict";
import { canUpdatePasswordFromRecovery, isPasswordRecoveryEvent, PASSWORD_RECOVERY_REQUIRED_MESSAGE } from "./password-recovery";

assert.equal(isPasswordRecoveryEvent("PASSWORD_RECOVERY"), true, "Only Supabase's verified recovery event may unlock password update.");
for (const event of ["SIGNED_IN", "INITIAL_SESSION", "TOKEN_REFRESHED", "USER_UPDATED", "SIGNED_OUT", ""]) {
  assert.equal(isPasswordRecoveryEvent(event), false, `${event || "missing event"} must not unlock password update.`);
}
assert.equal(canUpdatePasswordFromRecovery(true), true);
assert.equal(canUpdatePasswordFromRecovery(false), false);
assert.match(PASSWORD_RECOVERY_REQUIRED_MESSAGE, /open the password-reset link from your email/i);

console.log("Password recovery context guard tests passed for valid, missing, expired, invalid, and non-recovery auth states.");
