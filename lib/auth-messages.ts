export type AuthMessageMode = "sign-in" | "sign-up" | "reset-request" | "reset-password";

type AuthError = { message?: string; code?: string } | null;

export const customerAuthError = (error: AuthError, mode: AuthMessageMode): string => {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (text.includes("already registered") || text.includes("user already exists") || text.includes("user_already_exists")) return "An account with this email already exists. Sign in instead.";
  if (text.includes("invalid login credentials") || text.includes("invalid_credentials")) return "The email or password is incorrect. Try again or reset your password.";
  if (text.includes("same_password") || text.includes("same password")) return "Choose a different password than your current password.";
  if (text.includes("weak_password") || text.includes("weak password") || text.includes("password is too weak")) return "Choose a stronger password and try again.";
  if (text.includes("reauthentication_needed") || text.includes("reauthentication_not_valid")) return "For security, request a new password-reset email and try again.";
  if (text.includes("over_request_rate_limit") || text.includes("over_email_send_rate_limit")) return "Too many attempts. Wait a few minutes, then request a new password-reset email.";
  if (text.includes("session_not_found") || text.includes("session_expired") || text.includes("refresh_token_not_found") || text.includes("refresh_token_already_used") || text.includes("expired") || text.includes("otp_expired") || text.includes("invalid token") || text.includes("invalid_token")) return "This recovery link has expired or is no longer valid. Request a new password-reset email.";
  if (mode === "reset-request") return "We could not send a reset email. Check the address and try again.";
  if (mode === "reset-password") return "We could not update your password. The recovery link may have expired.";
  return "We could not complete that request. Check your details and try again.";
};

export const authFailureCode = (error: AuthError, mode: AuthMessageMode): string => {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (text.includes("invalid login credentials") || text.includes("invalid_credentials")) return "invalid_credentials";
  if (text.includes("already registered") || text.includes("user already exists") || text.includes("user_already_exists")) return "account_exists";
  if (text.includes("same_password") || text.includes("same password")) return "password_same_as_current";
  if (text.includes("weak_password") || text.includes("weak password") || text.includes("password is too weak")) return "password_policy_rejected";
  if (text.includes("reauthentication_needed") || text.includes("reauthentication_not_valid")) return "reauthentication_required";
  if (text.includes("over_request_rate_limit") || text.includes("over_email_send_rate_limit")) return "auth_rate_limited";
  if (text.includes("session_not_found") || text.includes("session_expired") || text.includes("refresh_token_not_found") || text.includes("refresh_token_already_used")) return "recovery_session_invalid";
  if (text.includes("expired") || text.includes("invalid token") || text.includes("invalid_token") || text.includes("otp_expired")) return "recovery_token_invalid";
  return `${mode.replace("-", "_")}_failed`;
};
