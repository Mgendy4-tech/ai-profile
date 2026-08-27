import { validateProductionEnvironment } from "./server/production-environment";
const main = async () => { const baseUrl = process.env.READINESS_BASE_URL?.replace(/\/$/, ""); const report = validateProductionEnvironment();
const routes = ["/api/analyze-structure", "/api/generate-profile", "/api/analyze-brand", "/api/visual-direction", "/api/select-visuals", "/api/plan-pdf-layout", "/api/health/readiness"];
const routeChecks = baseUrl ? await Promise.all(routes.map(async (path) => { try { const response = await fetch(`${baseUrl}${path}`, { method: "GET", redirect: "manual" }); return { path, reachable: response.status > 0 && response.status < 500, status: response.status }; } catch { return { path, reachable: false, status: null }; } })) : routes.map((path) => ({ path, reachable: null, status: null }));
console.log(JSON.stringify({ ...report, baseUrlChecked: baseUrl ?? null, routes: routeChecks }, null, 2)); if (!report.ready || routeChecks.some((entry) => entry.reachable === false)) process.exitCode = 1; };
main().catch(() => { console.error("Production readiness check failed without exposing configuration values."); process.exitCode = 1; });
