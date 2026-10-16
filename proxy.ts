import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/auth-env";
import { isBetaTestModeEnabled, isLocalQaFixtureRequest } from "@/lib/beta-test-mode";
import { authPathFor } from "@/lib/auth-redirect";

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
  return response;
}

export const config = {
  matcher: ["/beta-test", "/company", "/projects", "/generate", "/export", "/workspace", "/api/analyze-brand", "/api/analyze-structure", "/api/generate-profile", "/api/plan-pdf-layout", "/api/select-visuals", "/api/visual-direction"],
};
