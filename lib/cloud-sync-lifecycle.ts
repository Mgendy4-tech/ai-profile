export const CLOUD_SYNC_TIMEOUT_MS = 15_000;

export type CloudFetchResult<T> =
  | { ok: true; status: number; body: T }
  | { ok: false; code: "timeout" | "aborted" | "network" | "invalid_response" | string; status?: number };

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

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
