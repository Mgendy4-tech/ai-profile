import { safeFailureEvent, type SafeFailureEvent } from "@/lib/observability";

export type ServerObservabilityEvent = SafeFailureEvent & {
  timestamp: string;
  requestId: string;
};

export type ServerObservabilitySink = (event: ServerObservabilityEvent) => void | Promise<void>;

const DEDUPE_WINDOW_MS = 60_000;
const recentEvents = new Map<string, number>();
let sink: ServerObservabilitySink | null = null;

const requestId = () => crypto.randomUUID();

export const setServerObservabilitySink = (next: ServerObservabilitySink | null): void => {
  sink = next;
};

export const resetServerObservabilityDedupe = (): void => {
  recentEvents.clear();
};

export const logServerFailure = (event: SafeFailureEvent): void => {
  const safe = safeFailureEvent({ ...event, source: "server" });
  const key = `${safe.category}:${safe.code}:${safe.surface}:${safe.route ?? ""}:${safe.status ?? ""}`;
  const now = Date.now();
  const previous = recentEvents.get(key);
  if (previous && now - previous < DEDUPE_WINDOW_MS) return;
  recentEvents.set(key, now);
  if (recentEvents.size > 500) {
    for (const [candidate, timestamp] of recentEvents) if (now - timestamp >= DEDUPE_WINDOW_MS) recentEvents.delete(candidate);
  }
  const record: ServerObservabilityEvent = { ...safe, timestamp: new Date(now).toISOString(), requestId: requestId() };
  try {
    const pending = sink?.(record);
    if (pending && "catch" in pending) void pending.catch(() => undefined);
  } catch {
    // Observability must never affect a customer request.
  }
  if (!sink) console.error("[observability]", JSON.stringify(record));
};
