export const isBetaTestModeEnabled = (value: string | undefined): boolean => value === "true";

type QaRequest = { nextUrl: { hostname: string }; headers: { get: (name: string) => string | null } };

const localQaHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** Keep anonymous fixture access on a loopback QA server only. */
export const isLocalQaFixtureRequest = (request: QaRequest): boolean =>
  localQaHosts.has(request.nextUrl.hostname) && request.headers.get("x-lnkdit-qa-fixture") === "local";
