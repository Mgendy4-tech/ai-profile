import type { RankedImage } from "./types";

export type ImageCandidate = {
  candidateId: string;
  url: string;

  source: "unsplash" | "pexels";
  photographer: string;

  width: number;
  height: number;

  relevanceScore: number;
  compositionScore: number;
  textSafetyScore: number;
};

type RankingOptions = {
  minimumWidth?: number;
  minimumOverallScore?: number;
  minimumTextSafety?: number;
};

const DEFAULT_OPTIONS: Required<RankingOptions> = {
  minimumWidth: 1200,
  minimumOverallScore: 0.7,
  minimumTextSafety: 0.55,
};

const WEIGHTS = {
  relevance: 0.4,
  composition: 0.35,
  textSafety: 0.15,
  resolution: 0.1,
};

const clamp01 = (value: number) => {
  return Math.max(0, Math.min(1, value));
};

const getResolutionScore = (
  width: number,
  minimumWidth: number
) => {
  if (width >= 2400) {
    return 1;
  }

  if (width >= 1920) {
    return 0.9;
  }

  if (width >= minimumWidth) {
    return 0.75;
  }

  return 0;
};

export const rankImageCandidate = (
  candidate: ImageCandidate,
  options: RankingOptions = {}
): RankedImage => {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const relevance = clamp01(candidate.relevanceScore);
  const composition = clamp01(candidate.compositionScore);
  const textSafety = clamp01(candidate.textSafetyScore);

  const resolution = getResolutionScore(
    candidate.width,
    config.minimumWidth
  );

  const failsHardConstraint =
    candidate.width < config.minimumWidth ||
    textSafety < config.minimumTextSafety;

  const overallScore =
    relevance * WEIGHTS.relevance +
    composition * WEIGHTS.composition +
    textSafety * WEIGHTS.textSafety +
    resolution * WEIGHTS.resolution;

  let recommendation: RankedImage["recommendation"];

  if (failsHardConstraint) {
    recommendation = "reject";
  } else if (overallScore >= config.minimumOverallScore) {
    recommendation = "accept";
  } else {
    recommendation = "review";
  }

  return {
    candidateId: candidate.candidateId,
    url: candidate.url,
    source: candidate.source,
    photographer: candidate.photographer,

    scores: {
      relevance,
      composition,
      textSafety,
      resolution,
    },

    overallScore,
    recommendation,
  };
};

export const rankImageCandidates = (
  candidates: ImageCandidate[],
  options: RankingOptions = {}
) => {
  return candidates
    .map((candidate) =>
      rankImageCandidate(candidate, options)
    )
    .sort(
      (a, b) =>
        b.overallScore - a.overallScore
    );
};

export const getBestAcceptedImage = (
  candidates: ImageCandidate[],
  options: RankingOptions = {}
) => {
  const ranked = rankImageCandidates(
    candidates,
    options
  );

  return (
    ranked.find(
      (image) =>
        image.recommendation === "accept"
    ) ?? null
  );
};