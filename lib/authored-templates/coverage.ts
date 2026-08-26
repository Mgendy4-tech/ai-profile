import type { AuthoredDocumentPlan, CoverageIssue, CoverageResult, NormalizedContentUnit } from "./library-types";

export const validateDocumentCoverage = (
  units: readonly NormalizedContentUnit[],
  plan: AuthoredDocumentPlan,
): CoverageResult => {
  const knownIds = new Set(units.map((unit) => unit.id));
  const consumeCounts = new Map<string, number>();
  const consumedContentIds: string[] = [];
  const referencedContentIds: string[] = [];
  const issues: CoverageIssue[] = [];

  plan.pages.forEach((page, pageIndex) => page.claims.forEach((claim, claimIndex) => {
    const path = `pages.${pageIndex}.claims.${claimIndex}.contentId`;
    if (!knownIds.has(claim.contentId)) {
      issues.push({ code: "unknown_content_claim", path, contentId: claim.contentId, message: `Claimed content ID ${claim.contentId} does not exist.` });
      return;
    }
    if (claim.mode === "reference") {
      referencedContentIds.push(claim.contentId);
      return;
    }
    consumedContentIds.push(claim.contentId);
    const count = (consumeCounts.get(claim.contentId) ?? 0) + 1;
    consumeCounts.set(claim.contentId, count);
    if (count > 1) {
      issues.push({ code: "duplicate_content_consumption", path, contentId: claim.contentId, message: `Content ID ${claim.contentId} is consumed more than once.` });
    }
  }));

  units.forEach((unit) => {
    if (unit.coverage === "required" && !consumeCounts.has(unit.id)) {
      issues.push({ code: "required_content_not_consumed", path: unit.sourcePath, contentId: unit.id, message: `Required content ID ${unit.id} is not consumed.` });
    }
  });

  return issues.length === 0
    ? { complete: true, issues: [], consumedContentIds, referencedContentIds }
    : { complete: false, issues, consumedContentIds, referencedContentIds };
};
