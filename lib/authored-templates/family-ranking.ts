import type { AuthoredTemplateFamily, ContentShape, FamilyEvaluation, FamilyRankingExplanation } from "./library-types";

const evaluate = (families: readonly AuthoredTemplateFamily[], shape: ContentShape): FamilyEvaluation[] => families
  .map((family): FamilyEvaluation => {
    const result = family.evaluate(shape);
    return { familyId: family.id, eligible: result.eligible, score: result.reasons.reduce((total, reason) => total + reason.contribution, 0), priority: family.priority, reasons: result.reasons, hardReason: result.eligible ? null : result.reasons.filter((reason) => reason.contribution < 0).sort((a, b) => a.contribution - b.contribution || a.code.localeCompare(b.code))[0]?.code ?? "family_ineligible" };
  })
  .sort((left, right) => right.score - left.score || right.priority - left.priority || left.familyId.localeCompare(right.familyId));

export const explainAuthoredTemplateFamilyRanking = (families: readonly AuthoredTemplateFamily[], shape: ContentShape): FamilyRankingExplanation => {
  const evaluations = evaluate(families, shape);
  const eligibleFamilies = evaluations.filter((entry) => entry.eligible);
  return { evaluations, eligibleFamilies, rejectedFamilies: evaluations.filter((entry) => !entry.eligible), selectedFamilyId: eligibleFamilies[0]?.familyId ?? null };
};

export const rankAuthoredTemplateFamilies = (
  families: readonly AuthoredTemplateFamily[],
  shape: ContentShape,
): readonly FamilyEvaluation[] => explainAuthoredTemplateFamilyRanking(families, shape).eligibleFamilies;
