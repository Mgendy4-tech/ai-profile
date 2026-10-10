import { clearWorkspace, getActiveProfileStorage } from "./workspace";

export const APPLICATION_STORAGE_KEYS = ["companyData", "projectsData", "profileStructure", "generatedProfile", "authoredFamilyDecision", "authoredVariantDecision", "exportDecision"] as const;
export type ApplicationStorageKey = (typeof APPLICATION_STORAGE_KEYS)[number];
export type StorageRemoval = Pick<Storage, "removeItem" | "getItem">;
export type ApplicationStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type StorageFailureCode = "storage_quota" | "storage_unavailable";
export type StorageWriteResult = { ok: true } | { ok: false; code: StorageFailureCode };

export const readApplicationStorage = (storage: Pick<Storage, "getItem">, key: ApplicationStorageKey): string | null => {
  try { return getActiveProfileStorage(storage as Storage).getItem(key); } catch { return null; }
};

const storageFailureCode = (error: unknown): StorageFailureCode => {
  const name = error && typeof error === "object" && "name" in error ? String((error as { name?: unknown }).name) : "";
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" ? "storage_quota" : "storage_unavailable";
};

export const writeApplicationStorage = (storage: Pick<Storage, "setItem">, key: ApplicationStorageKey, value: string): StorageWriteResult => {
  try { getActiveProfileStorage(storage as Storage).setItem(key, value); return { ok: true }; } catch (error) { return { ok: false, code: storageFailureCode(error) }; }
};

export const removeApplicationStorage = (storage: Pick<Storage, "removeItem">, key: string): void => {
  try { getActiveProfileStorage(storage as Storage).removeItem(key); } catch { /* A failed cleanup must not break the next user action. */ }
};

export const clearDerivedProfileState = (storage: Pick<Storage, "removeItem">): void => {
  (['profileStructure', 'generatedProfile', 'authoredFamilyDecision', 'authoredVariantDecision', 'exportDecision'] as const).forEach((key) => removeApplicationStorage(storage, key));
};

export const storageUserMessage = (code: StorageFailureCode): string =>
  code === "storage_quota"
    ? "Your browser could not save this change because storage is full. Remove an image or clear unused saved data, then try again."
    : "Your browser storage is unavailable. Please enable site storage and try again.";

export const clearApplicationLocalData = (storage: StorageRemoval) => {
  const removed = APPLICATION_STORAGE_KEYS.filter((key) => { try { return storage.getItem(key) !== null; } catch { return false; } });
  if (typeof window !== "undefined" && storage === window.localStorage) clearWorkspace(storage);
  else APPLICATION_STORAGE_KEYS.forEach((key) => removeApplicationStorage(storage, key));
  const complete = APPLICATION_STORAGE_KEYS.every((key) => { try { return storage.getItem(key) === null; } catch { return false; } });
  return { removedKeys: removed, complete } as const;
};
