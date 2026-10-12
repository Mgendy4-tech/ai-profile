import { safeFailureEvent, type SafeFailureEvent } from "./observability";

const DEDUPE_WINDOW_MS = 60_000;
const recentEvents = new Map<string, number>();

export const reportClientFailure = (event: Omit<SafeFailureEvent, "source">): void => {
  if (typeof window === "undefined") return;
  const safe = safeFailureEvent({ ...event, source: "client", route: event.route ?? window.location.pathname });
  const key = `${safe.category}:${safe.code}:${safe.surface}:${safe.route ?? ""}`;
  const now = Date.now();
  const previous = recentEvents.get(key);
  if (previous && now - previous < DEDUPE_WINDOW_MS) return;
  recentEvents.set(key, now);
  if (recentEvents.size > 100) {
    for (const [candidate, timestamp] of recentEvents) if (now - timestamp >= DEDUPE_WINDOW_MS) recentEvents.delete(candidate);
  }
  void fetch("/api/telemetry", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(safe),
    keepalive: true,
  }).catch(() => undefined);
};
