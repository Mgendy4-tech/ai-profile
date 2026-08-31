import type { AuthoredExportDecision, AuthoredExportFallbackReason } from "./authored-templates/export-orchestrator";

export type AuthoredExportDevelopmentDiagnostic = {
  error: { name: string; code: string; message: string; stack: string | null; cause: string | null };
  authoredFamily: string | null;
  selectedPack: string | null;
  projectCount: number;
  projectIds: readonly string[];
  images: readonly { projectId: string; exists: boolean; sourceType: "data_url" | "blob_url" | "remote_url" | "other"; mimeType: string | null; byteLength: number | null; provenance: "user_upload"; role: "project_image" }[];
  plannerResult: "failed" | "passed" | "not_reached";
  preflightResult: "failed" | "passed" | "not_reached";
  failingTemplateOrPage: string | null;
  reasons: readonly AuthoredExportFallbackReason[];
};

const packForFamily = (family: string | null) => family === "visual-portfolio"
  ? "editorial-interiors-v1"
  : family === "corporate-services"
    ? "corporate-services-v1"
    : family === "product-tech"
      ? "product-tech-v1"
      : null;

const sourceStatus = (source: string) => {
  const match = /^data:([^;,]+)(?:;base64)?,/i.exec(source);
  const payload = match ? source.slice(source.indexOf(",") + 1).replace(/\s/g, "") : "";
  const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
  return {
    sourceType: match ? "data_url" as const : /^blob:/i.test(source) ? "blob_url" as const : /^https?:/i.test(source) ? "remote_url" as const : "other" as const,
    mimeType: match?.[1]?.toLowerCase() ?? null,
    byteLength: match ? Math.max(0, Math.floor(payload.length * 3 / 4) - padding) : null,
  };
};

export const createAuthoredRejectionDiagnostic = (
  decision: Extract<AuthoredExportDecision, { mode: "fallback" }>,
  projects: readonly { id: string; imageUrl: string }[],
): AuthoredExportDevelopmentDiagnostic => {
  const first = decision.reasons[0] ?? { stage: "ranking" as const, code: "unknown_authored_rejection", path: "authoredDecision", pageRole: null };
  const family = decision.ranking?.selectedFamilyId ?? null;
  const message = `${first.code} at ${first.path}${first.pageRole ? ` (${first.pageRole})` : ""}`;
  const cause = decision.reasons.length > 1 ? decision.reasons.slice(1).map((reason) => `${reason.code} at ${reason.path}`).join("; ") : null;
  return {
    error: { name: "AuthoredExportRejection", code: first.code, message, stack: new Error(message).stack ?? null, cause },
    authoredFamily: family,
    selectedPack: packForFamily(family),
    projectCount: projects.length,
    projectIds: projects.map((project) => project.id),
    images: projects.map((project) => ({ projectId: project.id, exists: Boolean(project.imageUrl), ...sourceStatus(project.imageUrl), provenance: "user_upload" as const, role: "project_image" as const })),
    plannerResult: first.stage === "planning" ? "failed" : first.stage === "compatibility" || first.stage === "operational" ? "passed" : "not_reached",
    preflightResult: first.stage === "compatibility" ? "failed" : first.stage === "operational" ? "passed" : "not_reached",
    failingTemplateOrPage: first.pageRole ?? (first.stage === "compatibility" ? first.path : null),
    reasons: decision.reasons,
  };
};

export const authoredDevelopmentFailureMessage = (diagnostic: AuthoredExportDevelopmentDiagnostic) =>
  `Authored export failed: ${diagnostic.error.code} - ${diagnostic.error.message}`;
