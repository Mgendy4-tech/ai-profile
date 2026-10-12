export const OBSERVABILITY_CATEGORIES = [
  "auth_failure",
  "cloud_sync_failure",
  "storage_upload_failure",
  "storage_hydration_failure",
  "profile_generation_failure",
  "pdf_export_failure",
  "client_runtime_error",
  "server_api_error",
] as const;

export type ObservabilityCategory = (typeof OBSERVABILITY_CATEGORIES)[number];

export type SafeFailureEvent = {
  category: ObservabilityCategory;
  code: string;
  surface: string;
  route?: string;
  status?: number;
  source?: "client" | "server";
};

export const isObservabilityCategory = (value: unknown): value is ObservabilityCategory =>
  typeof value === "string" && (OBSERVABILITY_CATEGORIES as readonly string[]).includes(value);

export const safeFailureEvent = (event: SafeFailureEvent): SafeFailureEvent => ({
  category: event.category,
  code: event.code.slice(0, 80).replace(/[^a-z0-9_.:-]/gi, "_"),
  surface: event.surface.slice(0, 80).replace(/[^a-z0-9_.:/-]/gi, "_"),
  ...(event.route ? { route: event.route.split("?")[0].slice(0, 120) } : {}),
  ...(typeof event.status === "number" ? { status: event.status } : {}),
  ...(event.source ? { source: event.source } : {}),
});
