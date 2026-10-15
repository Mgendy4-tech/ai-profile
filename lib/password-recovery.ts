export const PASSWORD_RECOVERY_REQUIRED_MESSAGE = "For security, open the password-reset link from your email to choose a new password.";

export const isPasswordRecoveryEvent = (event: string): boolean => event === "PASSWORD_RECOVERY";

export const canUpdatePasswordFromRecovery = (recoveryVerified: boolean): boolean => recoveryVerified;
