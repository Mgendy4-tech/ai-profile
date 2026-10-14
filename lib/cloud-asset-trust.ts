export const CUSTOMER_ASSETS_BUCKET = "customer-assets";
export type TrustedCloudAssetKind = "logo" | "project";

export type TrustedHydratedCloudAsset = Readonly<{
  url: string;
  path: string;
  userId: string;
  profileId: string;
  kind: TrustedCloudAssetKind;
}>;

const TRUST_REGISTRY_KEY = "__lnkditTrustedCloudAssets";
type TrustRegistryGlobal = typeof globalThis & { [TRUST_REGISTRY_KEY]?: Map<string, TrustedHydratedCloudAsset> };
const trustedAssets = (): Map<string, TrustedHydratedCloudAsset> => {
  const root = globalThis as TrustRegistryGlobal;
  if (!root[TRUST_REGISTRY_KEY]) root[TRUST_REGISTRY_KEY] = new Map<string, TrustedHydratedCloudAsset>();
  return root[TRUST_REGISTRY_KEY];
};

export const ownedCloudAssetPath = (userId: string, profileId: string): string => `${userId}/${profileId}/`;

export const isOwnedCloudAssetPath = (path: unknown, userId: string, profileId?: string): path is string =>
  typeof path === "string" &&
  path.length > 0 &&
  path.startsWith(profileId ? ownedCloudAssetPath(userId, profileId) : `${userId}/`) &&
  !path.includes("..") &&
  !path.startsWith("/") &&
  !path.endsWith("/");

export const inferTrustedCloudAssetKind = (path: string): TrustedCloudAssetKind | null => {
  const file = path.split("/").pop() ?? "";
  if (/^logo-[^/]+\.(?:png|jpe?g)$/i.test(file)) return "logo";
  if (/^project-[^/]+\.(?:png|jpe?g)$/i.test(file)) return "project";
  return null;
};

const encodedPath = (path: string): string => path.split("/").map((part) => encodeURIComponent(part)).join("/");

const signedPathFor = (url: string): string | null => {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    const prefix = `/storage/v1/object/sign/${CUSTOMER_ASSETS_BUCKET}/`;
    if (!parsed.pathname.startsWith(prefix)) return null;
    const value = parsed.pathname.slice(prefix.length);
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

export const registerTrustedHydratedCloudAsset = (
  url: string,
  path: string,
  userId: string,
  profileId: string,
  kind: TrustedCloudAssetKind,
): TrustedHydratedCloudAsset | null => {
  if (!userId || !profileId || !isOwnedCloudAssetPath(path, userId, profileId) || inferTrustedCloudAssetKind(path) !== kind) return null;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }
  const prefix = `/storage/v1/object/sign/${CUSTOMER_ASSETS_BUCKET}/`;
  if (parsed.protocol !== "https:" || parsed.pathname !== `${prefix}${encodedPath(path)}`) return null;
  const trusted: TrustedHydratedCloudAsset = { url, path, userId, profileId, kind };
  trustedAssets().set(url, trusted);
  return trusted;
};

export const getTrustedHydratedCloudAsset = (url: unknown): TrustedHydratedCloudAsset | null =>
  typeof url === "string" ? trustedAssets().get(url) ?? null : null;

export const isTrustedHydratedCloudAsset = (
  url: unknown,
  path: unknown,
  kind: TrustedCloudAssetKind,
  profileId?: string,
): url is string => {
  if (typeof url !== "string" || typeof path !== "string") return false;
  const trusted = trustedAssets().get(url);
  return Boolean(trusted && trusted.path === path && trusted.kind === kind && (!profileId || trusted.profileId === profileId));
};

export const clearTrustedHydratedCloudAssets = (): void => { trustedAssets().clear(); };

export const trustedCloudAssetCount = (): number => trustedAssets().size;
