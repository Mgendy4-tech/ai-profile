export const APPLICATION_STORAGE_KEYS = ["companyData", "projectsData", "profileStructure", "generatedProfile", "authoredFamilyDecision", "exportDecision"] as const;
export type ApplicationStorageKey = (typeof APPLICATION_STORAGE_KEYS)[number];
export type StorageRemoval = Pick<Storage, "removeItem" | "getItem">;

export const clearApplicationLocalData = (storage: StorageRemoval) => {
  const removed = APPLICATION_STORAGE_KEYS.filter((key) => storage.getItem(key) !== null);
  APPLICATION_STORAGE_KEYS.forEach((key) => storage.removeItem(key));
  return { removedKeys: removed, complete: APPLICATION_STORAGE_KEYS.every((key) => storage.getItem(key) === null) } as const;
};
