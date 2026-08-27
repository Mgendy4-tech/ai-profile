import assert from "node:assert/strict";
import { emitProductionTelemetry, setProductionTelemetryAdapter, type ProductionTelemetryEvent } from "./production-telemetry";
const events: ProductionTelemetryEvent[] = []; setProductionTelemetryAdapter({ emit: (event) => { events.push(event); } });
emitProductionTelemetry({ name: "model_generation_rejected", failureClass: "model_contract_rejection", reasonCode: "generated_section_missing_id", latencyMs: 12 });
emitProductionTelemetry({ name: "family_selected", familyId: "corporate-services", packId: "corporate-services-v1" });
emitProductionTelemetry({ name: "export_succeeded", familyId: "corporate-services", packId: "corporate-services-v1", latencyMs: 20, pdfBytes: 1000, pageCount: 4 });
assert.equal(events.length, 3); assert(!JSON.stringify(events).match(/companyName|content|imageUrl|base64|apiKey|stack/i));
setProductionTelemetryAdapter({ emit: () => { throw new Error("backend unavailable"); } }); assert.doesNotThrow(() => emitProductionTelemetry({ name: "export_failed", failureClass: "export_failure", reasonCode: "pdf_export_failed", latencyMs: 1 })); setProductionTelemetryAdapter(null);
console.log("Typed privacy-safe fail-open production telemetry tests passed.");
