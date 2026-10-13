const RECOVERY_PATH = "/auth?mode=reset";

const isSafeOrigin = (value: string | undefined): value is string => {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
};

/**
 * The browser origin wins so Preview stays independent from a production
 * canonical URL. The configured URL is a safe fallback for non-browser use.
 */
export const resolvePublicOrigin = (currentOrigin?: string, configuredSiteUrl?: string): string | null => {
  if (isSafeOrigin(currentOrigin)) return new URL(currentOrigin).origin;
  if (isSafeOrigin(configuredSiteUrl)) return new URL(configuredSiteUrl).origin;
  return null;
};

export const passwordRecoveryRedirect = (currentOrigin?: string, configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL): string => {
  const origin = resolvePublicOrigin(currentOrigin, configuredSiteUrl);
  return origin ? new URL(RECOVERY_PATH, origin).toString() : RECOVERY_PATH;
};
