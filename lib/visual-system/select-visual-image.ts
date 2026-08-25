import { searchPexelsImages } from "./image-source";
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
};

const DEFAULT_CANDIDATE_COUNT = 3;

const buildSearchQuery = (brief: VisualImageBrief) => {
  const mood = brief.moodKeywords.slice(0, 3).join(" ");

  return `${brief.subject} ${mood}`.trim();
};

export const selectVisualImage = async (
  brief: VisualImageBrief,
  options: SelectVisualImageOptions = {}
): Promise<SelectedVisualImage> => {
  const candidateCount =
    options.candidateCount ?? DEFAULT_CANDIDATE_COUNT;

  const searchQuery = buildSearchQuery(brief);

  const sourcedImages = await searchPexelsImages(
    searchQuery,
    candidateCount
  );

  if (sourcedImages.length === 0) {
    return {
      briefId: brief.id,
      status: "fallback",
      selectedImage: null,
      fallbackReason: "No image candidates returned by Pexels.",
    };
  }

  const candidates: ImageCandidate[] = [];

  for (const image of sourcedImages) {
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

      candidates.push({
        candidateId: image.candidateId,
        url: image.url,
        source: image.source,
        photographer: image.photographer,
        width: image.width,
        height: image.height,
        relevanceScore: vision.relevance,
        compositionScore: vision.composition,
        textSafetyScore: vision.textSafety,
      });
    } catch (error) {
      console.error(
        `Vision scoring failed for ${image.candidateId}:`,
        error
      );
    }
  }

  if (candidates.length === 0) {
    return {
      briefId: brief.id,
      status: "fallback",
      selectedImage: null,
      fallbackReason: "All candidate images failed vision scoring.",
    };
  }

  const ranked = rankImageCandidates(candidates);

  const bestAccepted = ranked.find(
    (image) => image.recommendation === "accept"
  );

  if (!bestAccepted) {
    return {
      briefId: brief.id,
      status: "fallback",
      selectedImage: null,
      fallbackReason:
        "No candidate passed the visual quality threshold.",
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