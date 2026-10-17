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

// Normal sign-in returns to the homepage; recovery must retain its verified context.
export const authPageDestination = (search: string, hash = ""): string | null => {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  if (query.get("mode") === "reset" || query.has("code") || fragment.get("type") === "recovery") return null;
  return safeNextPath(query.get("next"), "/");
};
