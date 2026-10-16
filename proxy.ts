import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/auth-env";
import { isBetaTestModeEnabled, isLocalQaFixtureRequest } from "@/lib/beta-test-mode";
import { authPathFor } from "@/lib/auth-redirect";
import { reserveTrialAiRequest } from "@/lib/trial-ai-budget";

const protectedPaths = new Set(["/company", "/projects", "/generate", "/export", "/workspace"]);
const protectedAiApiPaths = new Set([
  "/api/analyze-brand", "/api/analyze-structure", "/api/generate-profile",
  "/api/plan-pdf-layout", "/api/select-visuals", "/api/visual-direction",
]);
const unauthorizedApi = () => NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const betaFixtureRequest = isBetaTestModeEnabled(process.env.NEXT_PUBLIC_BETA_TEST_MODE) && isLocalQaFixtureRequest(request);

  if (pathname === "/beta-test" && isBetaTestModeEnabled(process.env.NEXT_PUBLIC_BETA_TEST_MODE) && !betaFixtureRequest) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  const isProtectedApi = protectedAiApiPaths.has(pathname);
  if (!protectedPaths.has(pathname) && !isProtectedApi) return NextResponse.next();

  // Fixture access is loopback-only and requires the explicit QA marker.
  // Beta mode is never an anonymous bypass on Preview or Production hosts.
  if (betaFixtureRequest) return NextResponse.next();

  const config = getSupabaseConfig();
  if (!config) return isProtectedApi ? unauthorizedApi() : NextResponse.redirect(new URL(authPathFor(`${request.nextUrl.pathname}${request.nextUrl.search}`), request.url));

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return isProtectedApi ? unauthorizedApi() : NextResponse.redirect(new URL(authPathFor(`${request.nextUrl.pathname}${request.nextUrl.search}`), request.url));
  if (isProtectedApi && request.method === "POST") {
    const budget = await reserveTrialAiRequest(() => supabase.rpc("consume_trial_ai_request"));
    if (budget !== "allowed") {
      const limited = budget === "limited";
      return NextResponse.json({ ok: false, code: limited ? "trial_ai_limit" : "trial_ai_unavailable", error: limited
        ? "The free trial AI allowance has been reached. Please try again tomorrow. Your saved work and PDF exports remain available."
        : "AI is temporarily unavailable. Please try again later. Your saved work is safe." },
      { status: limited ? 429 : 503, headers: { "Cache-Control": "no-store", ...(limited ? { "Retry-After": String(Math.max(1, Math.ceil((Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()+1) - Date.now())/1000))) } : {}) } });
    }
  }
  return response;
}

export const config = {
  matcher: ["/beta-test", "/company", "/projects", "/generate", "/export", "/workspace", "/api/analyze-brand", "/api/analyze-structure", "/api/generate-profile", "/api/plan-pdf-layout", "/api/select-visuals", "/api/visual-direction"],
};
