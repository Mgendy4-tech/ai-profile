// Bounded request reader: reject oversized JSON before buffering the entire
// workspace into memory. Never log the submitted profile data or credentials.
export const MAX_CLOUD_WORKSPACE_BYTES = 8 * 1024 * 1024;

export type CloudWorkspaceRequestResult =
  | { ok: true; value: unknown }
  | { ok: false; code: "invalid_payload" | "payload_too_large" };

export const readCloudWorkspaceJson = async (request: Request): Promise<CloudWorkspaceRequestResult> => {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_CLOUD_WORKSPACE_BYTES) {
    return { ok: false, code: "payload_too_large" };
  }
  if (!request.body) return { ok: false, code: "invalid_payload" };
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let totalBytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      totalBytes += chunk.value.byteLength;
      if (totalBytes > MAX_CLOUD_WORKSPACE_BYTES) {
        void reader.cancel().catch(() => undefined);
        return { ok: false, code: "payload_too_large" };
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, code: "invalid_payload" };
  } finally {
    reader.releaseLock();
  }
};
