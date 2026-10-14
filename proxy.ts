import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/auth-env";
import { isBetaTestModeEnabled } from "@/lib/beta-test-mode";
import { authPathFor } from "@/lib/auth-redirect";

const protectedPaths = new Set(["/company", "/projects", "/generate", "/export", "/workspace"]);

export async function proxy(request: NextRequest) {
  if (!protectedPaths.has(request.nextUrl.pathname)) return NextResponse.next();

  // The local Preview QA harness intentionally exercises the real workflow without a customer account.
  // This branch is enabled only by the Preview/test build flag and is false in Production.
  if (isBetaTestModeEnabled(process.env.NEXT_PUBLIC_BETA_TEST_MODE)) return NextResponse.next();

  const config = getSupabaseConfig();
  if (!config) return NextResponse.redirect(new URL(authPathFor(`${request.nextUrl.pathname}${request.nextUrl.search}`), request.url));

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
  if (!user) return NextResponse.redirect(new URL(authPathFor(`${request.nextUrl.pathname}${request.nextUrl.search}`), request.url));
  return response;
}

export const config = {
  matcher: ["/company", "/projects", "/generate", "/export", "/workspace"],
};
