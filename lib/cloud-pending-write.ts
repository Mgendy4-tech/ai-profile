// A durable revision survives page reloads during the autosave debounce.
const OWNER_KEY = "workspaceCloudOwnerId";
export const CLOUD_PENDING_WRITE_KEY = "workspaceCloudPendingWrite";
type PendingStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export const markPendingCloudWrite = (storage: PendingStorage): void => {
  const ownerId = storage.getItem(OWNER_KEY);
  if (ownerId) storage.setItem(CLOUD_PENDING_WRITE_KEY, JSON.stringify({ ownerId, revision: crypto.randomUUID() }));
};
export const pendingCloudWrite = (storage: Pick<Storage, "getItem">, ownerId: string): string | null => {
  try {
    const value = JSON.parse(storage.getItem(CLOUD_PENDING_WRITE_KEY) ?? "null");
    return storage.getItem(OWNER_KEY) === ownerId && value?.ownerId === ownerId && typeof value.revision === "string" ? value.revision : null;
  } catch { return null; }
};
export const acknowledgeCloudWrite = (storage: PendingStorage, ownerId: string, revision: string | null): void => {
  if (revision && pendingCloudWrite(storage, ownerId) === revision) storage.removeItem(CLOUD_PENDING_WRITE_KEY);
};
