import {
  searchPexelsImages,
  type PexelsImageCandidate,
  type PexelsOrientation,
} from "./image-source";
import { scoreImageWithVision } from "./vision-score";
import {
  rankImageCandidates,
  type ImageCandidate,
} from "./rank-images";

export type VisualImageBrief = {
  id: string;
  subject: string;
  purpose: "hero" | "contextual" | "supporting";
  placement: "full_bleed" | "column" | "side";
  aspectRatio: "16:9" | "4:3" | "1:1";
  moodKeywords: string[];
};

export type SelectedVisualImage = {
  briefId: string;

  status: "selected" | "fallback";

  selectedImage: {
    candidateId: string;
    url: string;
    source: "pexels";
    photographer: string;
    width: number;
    height: number;
    overallScore: number;
  } | null;

  fallbackReason: string | null;
};

type SelectVisualImageOptions = {
  candidateCount?: number;
  onSearchAttempt?: (attempt: {
    attempt: 1 | 2;
    query: string;
    orientation: PexelsOrientation;
  }) => void;
};

const DEFAULT_CANDIDATE_COUNT = 3;
const MAX_VISION_CONCURRENCY = 2;

const SEARCH_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "featuring",
  "for",
  "in",
  "of",
  "or",
  "the",
  "with",
]);

const getSearchTerms = (value: string) => {
  const terms = value
    .toLowerCase()
    .match(/[a-z0-9]+/g)
    ?.filter((term) => !SEARCH_STOP_WORDS.has(term)) ?? [];

  return [...new Set(terms)];
};

const buildSearchQuery = (brief: VisualImageBrief) => {
  const subjectTerms = getSearchTerms(brief.subject).slice(0, 6);
  const subjectTermSet = new Set(subjectTerms);
  const moodTerms = getSearchTerms(
    brief.moodKeywords.join(" ")
  )
    .filter((term) => !subjectTermSet.has(term))
    .slice(0, 3);

  return [...subjectTerms, ...moodTerms].join(" ");
};

const buildBroaderSearchQuery = (brief: VisualImageBrief) => {
  return getSearchTerms(brief.subject).slice(0, 3).join(" ");
};

const getPreferredOrientation = (
  aspectRatio: VisualImageBrief["aspectRatio"]
): PexelsOrientation => {
  return aspectRatio === "1:1" ? "square" : "landscape";
};

const scoreCandidates = async (
  sourcedImages: PexelsImageCandidate[],
  brief: VisualImageBrief
) => {
  const scoredCandidates = new Array<ImageCandidate | undefined>(
    sourcedImages.length
  );
  let nextCandidateIndex = 0;

  const processNextCandidate = async (): Promise<void> => {
    while (nextCandidateIndex < sourcedImages.length) {
      const candidateIndex = nextCandidateIndex;
      nextCandidateIndex += 1;
      const image = sourcedImages[candidateIndex];

      try {
        const vision = await scoreImageWithVision({
          imageUrl: image.url,
          brief: {
            subject: brief.subject,
            purpose: brief.purpose,
            placement: brief.placement,
            aspectRatio: brief.aspectRatio,
            moodKeywords: brief.moodKeywords,
          },
        });

        scoredCandidates[candidateIndex] = {
          candidateId: image.candidateId,
          url: image.url,
          source: image.source,
          photographer: image.photographer,
          width: image.width,
          height: image.height,
          targetAspectRatio: brief.aspectRatio,
          relevanceScore: vision.relevance,
          compositionScore: vision.composition,
          textSafetyScore: vision.textSafety,
        };
      } catch (error) {
        console.error(
          `Vision scoring failed for ${image.candidateId}:`,
          error
        );
      }
    }
  };

  const workerCount = Math.min(
    MAX_VISION_CONCURRENCY,
    sourcedImages.length
  );
  const workers = Array.from(
    { length: workerCount },
    () => processNextCandidate()
  );

  await Promise.all(workers);

  const candidates = scoredCandidates.filter(
    (candidate): candidate is ImageCandidate => candidate !== undefined
  );

  return rankImageCandidates(candidates);
};

export const selectVisualImage = async (
  brief: VisualImageBrief,
  options: SelectVisualImageOptions = {}
): Promise<SelectedVisualImage> => {
  const candidateCount =
    options.candidateCount ?? DEFAULT_CANDIDATE_COUNT;

  const orientation = getPreferredOrientation(brief.aspectRatio);
  const searchQueries = [
    buildSearchQuery(brief),
    buildBroaderSearchQuery(brief),
  ];

  let sourcedImages: PexelsImageCandidate[] = [];
  let bestAccepted: ReturnType<typeof rankImageCandidates>[number] | undefined;
  let finalAttemptHadScoredCandidates = false;

  for (const [index, query] of searchQueries.entries()) {
    const attempt = (index + 1) as 1 | 2;

    options.onSearchAttempt?.({ attempt, query, orientation });

    sourcedImages = await searchPexelsImages(
      query,
      candidateCount,
      orientation
    );

    const ranked = await scoreCandidates(sourcedImages, brief);
    finalAttemptHadScoredCandidates = ranked.length > 0;
    bestAccepted = ranked.find(
      (image) => image.recommendation === "accept"
    );

    if (bestAccepted) {
      break;
    }
  }

  if (!bestAccepted) {
    const fallbackReason =
      sourcedImages.length === 0
        ? "No image candidates returned by Pexels."
        : !finalAttemptHadScoredCandidates
        ? "All candidate images failed vision scoring."
        : "No candidate passed the visual quality threshold.";

    return {
      briefId: brief.id,
      status: "fallback",
      selectedImage: null,
      fallbackReason,
    };
  }

  const originalImage = sourcedImages.find(
    (image) =>
      image.candidateId === bestAccepted.candidateId
  );

  if (!originalImage) {
    return {
      briefId: brief.id,
      status: "fallback",
      selectedImage: null,
      fallbackReason:
        "Selected image metadata could not be resolved.",
    };
  }

  return {
    briefId: brief.id,
    status: "selected",

    selectedImage: {
      candidateId: bestAccepted.candidateId,
      url: bestAccepted.url,
      source: "pexels",
      photographer: bestAccepted.photographer,
      width: originalImage.width,
      height: originalImage.height,
      overallScore: bestAccepted.overallScore,
    },

    fallbackReason: null,
  };
};
