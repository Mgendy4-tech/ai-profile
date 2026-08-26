import type { PageRole, TemplatePack } from "./types";

export type TemplateFamilyId = string;

export type NormalizedContentKind =
  | "company_identity"
  | "narrative_section"
  | "service_capability"
  | "project";

export type ContentCoveragePolicy = "required" | "optional";

type NormalizedContentUnitBase = {
  id: string;
  kind: NormalizedContentKind;
  sourcePath: string;
  coverage: ContentCoveragePolicy;
};

export type NormalizedContentUnit =
  | (NormalizedContentUnitBase & { kind: "company_identity" })
  | (NormalizedContentUnitBase & { kind: "narrative_section"; characterCount: number })
  | (NormalizedContentUnitBase & { kind: "service_capability" })
  | (NormalizedContentUnitBase & { kind: "project"; hasAuthenticImage: boolean });

export type DeterministicContentFacts = {
  narrativeSectionCount: number;
  narrativeCharacterCount: number;
  serviceCount: number;
  projectCount: number;
  authenticProjectImageCount: number;
  authenticProjectImageCoverage: number;
  totalContentUnitCount: number;
};

export type SemanticEmphasis = "portfolio" | "services" | "product" | "narrative" | "mixed";

export type SemanticContentDescriptor = {
  emphasis: readonly SemanticEmphasis[];
  confidence: number;
  evidenceContentIds: readonly string[];
};

export type ContentShape = {
  facts: DeterministicContentFacts;
  semantics: SemanticContentDescriptor | null;
};

export type FamilyScoreContribution = -3 | -2 | -1 | 0 | 1 | 2 | 3;

export type FamilyEvaluationReason = {
  code: string;
  contribution: FamilyScoreContribution;
  evidenceContentIds: readonly string[];
};

export type FamilyEvaluation = {
  familyId: TemplateFamilyId;
  eligible: boolean;
  score: number;
  priority: number;
  reasons: readonly FamilyEvaluationReason[];
};

export type FamilyEvaluationInput = {
  eligible: boolean;
  reasons: readonly FamilyEvaluationReason[];
};

export type ContentClaim = {
  contentId: string;
  mode: "consume" | "reference";
  slotId: string;
};

export type AuthoredPagePlan<TCandidate extends object = object> = {
  pageId: string;
  templateId: string;
  pageRole: PageRole;
  candidate: TCandidate;
  claims: readonly ContentClaim[];
};

export type AuthoredDocumentPlan = {
  familyId: TemplateFamilyId;
  packId: string;
  pages: readonly AuthoredPagePlan[];
};

export type CoverageIssueCode =
  | "unknown_content_claim"
  | "required_content_not_consumed"
  | "duplicate_content_consumption";

export type CoverageIssue = {
  code: CoverageIssueCode;
  path: string;
  contentId: string;
  message: string;
};

export type CoverageResult =
  | {
      complete: true;
      issues: [];
      consumedContentIds: readonly string[];
      referencedContentIds: readonly string[];
    }
  | {
      complete: false;
      issues: readonly CoverageIssue[];
      consumedContentIds: readonly string[];
      referencedContentIds: readonly string[];
    };

export type AuthoredTemplateFamily = {
  id: TemplateFamilyId;
  label: string;
  priority: number;
  packs: readonly TemplatePack[];
  evaluate(shape: ContentShape): FamilyEvaluationInput;
};
