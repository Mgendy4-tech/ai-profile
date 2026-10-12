import { NextResponse } from "next/server";
import { isObservabilityCategory, safeFailureEvent, type SafeFailureEvent } from "@/lib/observability";
import { logServerFailure } from "@/lib/server/observability";

const isSafePayload = (value: unknown): value is SafeFailureEvent => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return isObservabilityCategory(candidate.category)
    && typeof candidate.code === "string"
    && candidate.code.length <= 120
    && typeof candidate.surface === "string"
    && candidate.surface.length <= 120
    && (candidate.route === undefined || typeof candidate.route === "string")
    && (candidate.status === undefined || typeof candidate.status === "number");
};

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    if (!isSafePayload(payload)) return NextResponse.json({ ok: false }, { status: 400 });
    logServerFailure(safeFailureEvent({ ...payload, source: "client" }));
    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
