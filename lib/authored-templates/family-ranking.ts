import type { AuthoredTemplateFamily, ContentShape, FamilyEvaluation } from "./library-types";

export const rankAuthoredTemplateFamilies = (
  families: readonly AuthoredTemplateFamily[],
  shape: ContentShape,
): readonly FamilyEvaluation[] => families
  .map((family): FamilyEvaluation => {
    const result = family.evaluate(shape);
    return {
      familyId: family.id,
      eligible: result.eligible,
      score: result.reasons.reduce((total, reason) => total + reason.contribution, 0),
      priority: family.priority,
      reasons: result.reasons,
    };
  })
  .filter((evaluation) => evaluation.eligible)
  .sort((left, right) =>
    right.score - left.score ||
    right.priority - left.priority ||
    left.familyId.localeCompare(right.familyId));
