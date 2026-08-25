import {
  getBestAcceptedImage,
  rankImageCandidates,
  type ImageCandidate,
} from "./rank-images";

const candidates: ImageCandidate[] = [
  {
    candidateId: "image-1",
    url: "https://example.com/image-1.jpg",
    source: "unsplash",
    photographer: "Photographer One",
    width: 2400,
    height: 1600,
    relevanceScore: 0.95,
    compositionScore: 0.9,
    textSafetyScore: 0.85,
  },
  {
    candidateId: "image-2",
    url: "https://example.com/image-2.jpg",
    source: "pexels",
    photographer: "Photographer Two",
    width: 1800,
    height: 1200,
    relevanceScore: 0.8,
    compositionScore: 0.75,
    textSafetyScore: 0.7,
  },
  {
    candidateId: "image-3",
    url: "https://example.com/image-3.jpg",
    source: "unsplash",
    photographer: "Photographer Three",
    width: 900,
    height: 600,
    relevanceScore: 0.99,
    compositionScore: 0.95,
    textSafetyScore: 0.9,
  },
];

const ranked = rankImageCandidates(candidates);

console.log("Ranked images:");

console.table(
  ranked.map((image) => ({
    id: image.candidateId,
    overallScore: image.overallScore.toFixed(3),
    recommendation: image.recommendation,
  }))
);

const best = getBestAcceptedImage(candidates);

console.log("\nBest accepted image:");
console.log(best);