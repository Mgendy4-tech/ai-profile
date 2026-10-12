export const CLOUD_SYNC_TIMEOUT_MS = 15_000;
export const CLOUD_SYNC_OPERATION_TIMEOUT_MS = 20_000;

export type CloudFetchResult<T> =
  | { ok: true; status: number; body: T }
  | { ok: false; code: "timeout" | "aborted" | "network" | "invalid_response" | string; status?: number };

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type SyncResult =
  | { ok: true; fingerprint: string; message?: string }
  | { ok: false; code: string; message?: string };

export type SyncRunner<Session> = (session: Session, signal: AbortSignal, preferLocal: boolean) => Promise<SyncResult>;

type ActiveSync<Session> = { id: number; sessionKey: string; fingerprint: string; controller: AbortController; promise: Promise<void> };

export class CloudSyncCoordinator<Session> {
  private active: ActiveSync<Session> | null = null;
  private pendingFingerprint: string | null = null;
  private operationId = 0;
  private lastSyncedFingerprint: string | null = null;
  private lastSyncedSessionKey: string | null = null;
  private disposed = false;

  public constructor(
    private readonly sessionKey: (session: Session) => string,
    private readonly onState: (state: "syncing" | "synced" | "sync-failed", message: string, operationId: number) => void,
    private readonly timeoutMs = CLOUD_SYNC_OPERATION_TIMEOUT_MS,
  ) {}

  public request(session: Session, fingerprint: string, runner: SyncRunner<Session>, queueIfActive = false): Promise<void> {
    if (this.disposed) return Promise.resolve();
    const key = this.sessionKey(session);
    if (this.active?.sessionKey === key) {
      if (queueIfActive && fingerprint !== this.lastSyncedFingerprint && fingerprint !== this.active.fingerprint) this.pendingFingerprint = fingerprint;
      return this.active.promise;
    }
    if (this.active) this.active.controller.abort();
    if (fingerprint === this.lastSyncedFingerprint && key === this.lastSyncedSessionKey) return Promise.resolve();
    const id = ++this.operationId;
    const controller = new AbortController();
    let timedOut = false;
    const isCurrent = () => !this.disposed && this.active?.id === id && this.operationId === id && !timedOut;
    const watchdog = setTimeout(() => {
      if (!isCurrent()) return;
      timedOut = true;
      this.operationId += 1;
      this.active = null;
      controller.abort();
      this.onState("sync-failed", "Cloud sync timed out. Your local data is safe; retry when ready.", id);
    }, this.timeoutMs);
    const run = async () => {
      if (isCurrent()) this.onState("syncing", "", id);
      try {
        const result = await runner(session, controller.signal, queueIfActive);
        if (!isCurrent()) return;
        if (!result.ok) { this.onState("sync-failed", result.message ?? "Cloud sync is temporarily unavailable. Your local data is safe; retry when ready.", id); return; }
        this.lastSyncedFingerprint = result.fingerprint;
        this.lastSyncedSessionKey = key;
        this.onState("synced", result.message ?? "", id);
      } catch {
        if (isCurrent()) this.onState("sync-failed", "Cloud sync is temporarily unavailable. Your local data is safe; retry when ready.", id);
      } finally {
        clearTimeout(watchdog);
        const isActive = this.active?.id === id;
        const canQueueFollowUp = isActive && !this.disposed && this.operationId === id && !timedOut;
        if (isActive) this.active = null;
        const pending = canQueueFollowUp ? this.pendingFingerprint : null;
        this.pendingFingerprint = null;
        if (pending && pending !== this.lastSyncedFingerprint) void this.request(session, pending, runner, true);
      }
    };
    let promise = Promise.resolve();
    this.active = { id, sessionKey: key, fingerprint, controller, promise };
    promise = run();
    this.active.promise = promise;
    return promise;
  }

  public cancel(): void {
    this.operationId += 1;
    this.active?.controller.abort();
    this.active = null;
    this.pendingFingerprint = null;
    this.lastSyncedFingerprint = null;
    this.lastSyncedSessionKey = null;
  }

  public resume(): void { this.disposed = false; }

  public dispose(): void {
    this.cancel();
    this.disposed = true;
  }

  public getLastSyncedFingerprint(): string | null { return this.lastSyncedFingerprint; }
}

export const fetchCloudJson = async <T>(
  fetchImpl: FetchLike,
  input: RequestInfo | URL,
  init: RequestInit,
  externalSignal: AbortSignal,
  timeoutMs = CLOUD_SYNC_TIMEOUT_MS,
): Promise<CloudFetchResult<T>> => {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  if (externalSignal.aborted) controller.abort();
  externalSignal.addEventListener("abort", abortFromCaller, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(input, { ...init, signal: controller.signal });
    let body: T;
    try {
      body = await response.json() as T;
    } catch {
      return { ok: false, code: "invalid_response", status: response.status };
    }
    if (!response.ok) {
      const code = body && typeof body === "object" && "code" in body && typeof body.code === "string" ? body.code : "cloud_unavailable";
      return { ok: false, code, status: response.status };
    }
    return { ok: true, status: response.status, body };
  } catch (error) {
    if (externalSignal.aborted) return { ok: false, code: "aborted" };
    if (error instanceof DOMException && error.name === "AbortError") return { ok: false, code: "timeout" };
    return { ok: false, code: "network" };
  } finally {
    clearTimeout(timer);
    externalSignal.removeEventListener("abort", abortFromCaller);
  }
};
