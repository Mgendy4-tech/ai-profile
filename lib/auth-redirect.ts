export const DEFAULT_AUTHENTICATED_PATH = "/company";

export const safeNextPath = (value: string | null | undefined, fallback = DEFAULT_AUTHENTICATED_PATH): string => {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const parsed = new URL(value, "https://lnkdit.invalid");
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return fallback;
  }
};

export const authPathFor = (nextPath = DEFAULT_AUTHENTICATED_PATH): string => `/auth?next=${encodeURIComponent(safeNextPath(nextPath))}`;
