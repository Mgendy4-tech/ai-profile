export type AuthoredExportContentEvidence = {
  persistedProjectCount: number;
  generatedProjectCount: number;
};

/** Project-bearing exports must either remain authored or fail explicitly. */
export const mustBlockLegacyFallback = (
  evidence: number | AuthoredExportContentEvidence,
) => typeof evidence === "number"
  ? evidence > 0
  : evidence.persistedProjectCount > 0 || evidence.generatedProjectCount > 0;

export const authoredExportPolicyCode = (evidence: AuthoredExportContentEvidence) =>
  evidence.persistedProjectCount > 0
    ? "project_state_persisted"
    : evidence.generatedProjectCount > 0
      ? "project_state_generated_only"
      : "project_state_absent";
