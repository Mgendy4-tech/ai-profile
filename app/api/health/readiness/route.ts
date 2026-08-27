import { validateProductionEnvironment } from "@/lib/server/production-environment";
export const runtime = "nodejs";
export function GET() { const report = validateProductionEnvironment(); return Response.json(report, { status: report.ready ? 200 : 503, headers: { "Cache-Control": "no-store" } }); }
