import type { AuthoredExportDevelopmentDiagnostic } from "@/lib/authored-export-diagnostics";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  const diagnostic = await request.json() as AuthoredExportDevelopmentDiagnostic;
  console.error("[authored-export-development-diagnostic]", diagnostic);
  return Response.json({ logged: true });
}
