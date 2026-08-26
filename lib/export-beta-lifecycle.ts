export type ExportOutcome = "authored_success" | "standard_success";
export type ExportFailureCategory = "pdf_export_failed";
export type ExportFallbackDiagnostic = {
  stage: "normalization" | "enrichment" | "ranking" | "planning" | "compatibility";
  code: string;
  pageRole: string | null;
};
export type ExportEvent =
  | { type: "EXPORT_STARTED"; eventId: string; timestamp: string }
  | { type: "EXPORT_COMPLETED"; eventId: string; timestamp: string; durationMs: number; outcome: ExportOutcome; familyId: string | null; pageCount: number; fallbackDiagnostics: readonly ExportFallbackDiagnostic[] }
  | { type: "EXPORT_FAILED"; eventId: string; timestamp: string; durationMs: number; category: ExportFailureCategory };
export type ExportEventSink = (event: ExportEvent) => void;

export const createExportAttemptGuard = () => {
  let active = false;
  return {
    tryStart: () => { if (active) return false; active = true; return true; },
    finish: () => { active = false; },
    isActive: () => active,
  };
};

const defaultRandomBytes = () => {
  const bytes = new Uint8Array(8); crypto.getRandomValues(bytes); return bytes;
};
export const createExportReferenceId = (randomBytes: () => Uint8Array = defaultRandomBytes) =>
  `EXP-${Array.from(randomBytes(), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}`;

export const createDevelopmentExportEventSink = (): ExportEventSink => {
  if (process.env.NODE_ENV === "production") return () => undefined;
  return (event) => console.info("[profile-export]", event);
};

export const emitExportStarted = (sink: ExportEventSink, eventId: string, timestampMs: number) => sink({ type: "EXPORT_STARTED", eventId, timestamp: new Date(timestampMs).toISOString() });
export const emitExportCompleted = (sink: ExportEventSink, eventId: string, startedAt: number, completedAt: number, outcome: ExportOutcome, familyId: string | null, pageCount: number, fallbackDiagnostics: readonly ExportFallbackDiagnostic[] = []) => sink({ type: "EXPORT_COMPLETED", eventId, timestamp: new Date(completedAt).toISOString(), durationMs: Math.max(0, completedAt - startedAt), outcome, familyId, pageCount, fallbackDiagnostics });
export const emitExportFailed = (sink: ExportEventSink, eventId: string, startedAt: number, failedAt: number) => sink({ type: "EXPORT_FAILED", eventId, timestamp: new Date(failedAt).toISOString(), durationMs: Math.max(0, failedAt - startedAt), category: "pdf_export_failed" });
