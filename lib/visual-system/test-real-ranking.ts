import { searchPexelsImages } from "./image-source";
import { scoreImageWithVision } from "./vision-score";
import {
  rankImageCandidates,
  getBestAcceptedImage,
  type ImageCandidate,
} from "./rank-images";

const brief = {
  subject:
    "Luxury interior material detail featuring premium marble or natural stone in a refined architectural setting.",
  purpose: "hero" as const,
  placement: "full_bleed" as const,
  aspectRatio: "16:9" as const,
  moodKeywords: [
    "luxury",
    "warm",
    "premium",
    "architectural",
    "editorial",
  ],
};

const run = async () => {
  const sourcedImages = await searchPexelsImages(
    "luxury interior design marble",
    3
  );

  const candidates: ImageCandidate[] = [];

  for (const image of sourcedImages) {
    console.log(`Scoring ${image.candidateId}...`);

    const vision = await scoreImageWithVision({
      imageUrl: image.url,
      brief,
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

    console.log({
      image: image.candidateId,
      relevance: vision.relevance,
      composition: vision.composition,
      textSafety: vision.textSafety,
      notes: vision.notes,
    });
  }

  const ranked = rankImageCandidates(candidates);

  console.log("\nFinal ranked images:");

  console.table(
    ranked.map((image) => ({
      id: image.candidateId,
      score: image.overallScore.toFixed(3),
      recommendation: image.recommendation,
      photographer: image.photographer,
    }))
  );

  const best = getBestAcceptedImage(candidates);

  console.log("\nBest accepted image:");

  if (!best) {
    console.log("No image passed the acceptance threshold.");
    return;
  }

  console.log({
    id: best.candidateId,
    photographer: best.photographer,
    score: best.overallScore,
    recommendation: best.recommendation,
    url: best.url,
  });
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});