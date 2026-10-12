export const passwordRecoveryRedirect = (origin: string): string => {
  const url = new URL("/auth?mode=reset", origin);
  return url.toString();
};
