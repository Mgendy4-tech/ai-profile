import { validateProductionEnvironment } from "@/lib/server/production-environment";

export const runtime = "nodejs";

// Public health checks expose only readiness, never which secrets or
// authentication configuration are present in the deployment.
export function GET() {
  const ready = validateProductionEnvironment().ready;
  return Response.json({ ok: ready, ready }, {
    status: ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
