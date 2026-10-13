export type AuthMessageMode = "sign-in" | "sign-up" | "reset-request" | "reset-password";

type AuthError = { message?: string; code?: string } | null;

export const customerAuthError = (error: AuthError, mode: AuthMessageMode): string => {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (text.includes("already registered") || text.includes("user already exists") || text.includes("user_already_exists")) return "An account with this email already exists. Sign in instead.";
  if (text.includes("invalid login credentials") || text.includes("invalid_credentials")) return "The email or password is incorrect. Try again or reset your password.";
  if (text.includes("expired") || text.includes("otp_expired") || text.includes("invalid token") || text.includes("invalid_token")) return "This recovery link has expired or is no longer valid. Request a new password-reset email.";
  if (mode === "reset-request") return "We could not send a reset email. Check the address and try again.";
  if (mode === "reset-password") return "We could not update your password. The recovery link may have expired.";
  return "We could not complete that request. Check your details and try again.";
};

export const authFailureCode = (error: AuthError, mode: AuthMessageMode): string => {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  if (text.includes("invalid login credentials") || text.includes("invalid_credentials")) return "invalid_credentials";
  if (text.includes("already registered") || text.includes("user already exists") || text.includes("user_already_exists")) return "account_exists";
  if (text.includes("expired") || text.includes("invalid token") || text.includes("invalid_token") || text.includes("otp_expired")) return "recovery_token_invalid";
  return `${mode.replace("-", "_")}_failed`;
};
