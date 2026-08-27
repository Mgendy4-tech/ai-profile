export type ProductionFailureClass = "model_contract_rejection" | "expected_authored_incompatibility" | "operational_limit" | "external_api_failure" | "export_failure" | "runtime_system_failure";
type FamilyId = "visual-portfolio" | "corporate-services" | "product-tech";
export type ProductionTelemetryEvent =
  | { name: "model_generation_rejected"; failureClass: "model_contract_rejection"; reasonCode: string; latencyMs: number }
  | { name: "model_generation_completed"; latencyMs: number; sectionCount: number }
  | { name: "structure_analysis_rejected"; failureClass: "model_contract_rejection"; reasonCode: string; latencyMs: number }
  | { name: "family_selected"; familyId: FamilyId; packId: string }
  | { name: "expected_fallback"; failureClass: "expected_authored_incompatibility" | "operational_limit"; category: string; reasonCodes: readonly string[] }
  | { name: "export_succeeded"; familyId: FamilyId | null; packId: string | null; latencyMs: number; pdfBytes: number; pageCount: number }
  | { name: "export_failed"; failureClass: "export_failure" | "runtime_system_failure"; reasonCode: string; latencyMs: number }
  | { name: "external_api_failed"; failureClass: "external_api_failure"; provider: "openai" | "pexels"; operation: string; reasonCode: string };
export type ProductionTelemetryAdapter = { emit(event: ProductionTelemetryEvent): void | Promise<void> };

let adapter: ProductionTelemetryAdapter | null = null;
export const setProductionTelemetryAdapter = (next: ProductionTelemetryAdapter | null) => { adapter = next; };
export const emitProductionTelemetry = (event: ProductionTelemetryEvent) => {
  try { const pending = adapter?.emit(event); if (pending && "catch" in pending) void pending.catch(() => undefined); } catch { /* Monitoring must never affect the product path. */ }
};
