// Client-only snapshot for late-mounting status indicators. No credentials or
// workspace data are stored here, only the latest UI status/message.
export type CloudSyncSnapshot = { status: "local-only" | "syncing" | "synced" | "sync-failed"; message: string };
let latest: CloudSyncSnapshot = { status: "local-only", message: "" };
export const currentCloudSyncSnapshot = (): CloudSyncSnapshot => ({ ...latest });
export const recordCloudSyncSnapshot = (status: CloudSyncSnapshot["status"], message = ""): void => {
  latest = { status, message };
};
