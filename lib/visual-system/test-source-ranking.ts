import { searchPexelsImages } from "./image-source";
import {
  rankImageCandidates,
  getBestAcceptedImage,
  type ImageCandidate,
} from "./rank-images";

const run = async () => {
  const sourced = await searchPexelsImages(
    "luxury interior design marble",
    5
  );

  const candidates: ImageCandidate[] = sourced.map((image, index) => ({
    ...image,

    // مؤقتًا للـMVP test:
    // لسه هنجيب القيم دي من Vision Analysis بعدين.
    relevanceScore: 0.9 - index * 0.05,
    compositionScore: 0.85 - index * 0.03,
    textSafetyScore: 0.8 - index * 0.02,
  }));

  const ranked = rankImageCandidates(candidates);

  console.log("Ranked sourced images:");

  console.table(
    ranked.map((image) => ({
      id: image.candidateId,
      score: image.overallScore.toFixed(3),
      recommendation: image.recommendation,
      photographer: image.photographer,
    }))
  );

  const best = getBestAcceptedImage(candidates);

  console.log("\nBest sourced image:");
  console.log(best);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});