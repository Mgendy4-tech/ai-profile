export const APPLICATION_STORAGE_KEYS = ["companyData", "projectsData", "profileStructure", "generatedProfile", "authoredFamilyDecision", "exportDecision"] as const;
export type ApplicationStorageKey = (typeof APPLICATION_STORAGE_KEYS)[number];
export type StorageRemoval = Pick<Storage, "removeItem" | "getItem">;
export type ApplicationStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type StorageFailureCode = "storage_quota" | "storage_unavailable";
export type StorageWriteResult = { ok: true } | { ok: false; code: StorageFailureCode };

const storageFailureCode = (error: unknown): StorageFailureCode => {
  const name = error && typeof error === "object" && "name" in error ? String((error as { name?: unknown }).name) : "";
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" ? "storage_quota" : "storage_unavailable";
};

export const writeApplicationStorage = (storage: Pick<Storage, "setItem">, key: ApplicationStorageKey, value: string): StorageWriteResult => {
  try { storage.setItem(key, value); return { ok: true }; } catch (error) { return { ok: false, code: storageFailureCode(error) }; }
};

export const removeApplicationStorage = (storage: Pick<Storage, "removeItem">, key: string): void => {
  try { storage.removeItem(key); } catch { /* A failed cleanup must not break the next user action. */ }
};

export const clearDerivedProfileState = (storage: Pick<Storage, "removeItem">): void => {
  (['profileStructure', 'generatedProfile', 'authoredFamilyDecision', 'exportDecision'] as const).forEach((key) => removeApplicationStorage(storage, key));
};

export const storageUserMessage = (code: StorageFailureCode): string =>
  code === "storage_quota"
    ? "Your browser could not save this change because storage is full. Remove an image or clear unused saved data, then try again."
    : "Your browser storage is unavailable. Please enable site storage and try again.";

export const clearApplicationLocalData = (storage: StorageRemoval) => {
  const removed = APPLICATION_STORAGE_KEYS.filter((key) => { try { return storage.getItem(key) !== null; } catch { return false; } });
  APPLICATION_STORAGE_KEYS.forEach((key) => removeApplicationStorage(storage, key));
  return { removedKeys: removed, complete: APPLICATION_STORAGE_KEYS.every((key) => { try { return storage.getItem(key) === null; } catch { return false; } }) } as const;
};
