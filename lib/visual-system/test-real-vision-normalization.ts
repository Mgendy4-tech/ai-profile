import assert from "node:assert/strict";
import sharp from "sharp";
import { normalizeVisionImage } from "./vision-image-normalizer";
import { scoreImageWithVision } from "./vision-score";

const candidateId = "17485633";

const run = async () => {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey || !process.env.OPENAI_API_KEY) throw new Error("PEXELS_API_KEY and OPENAI_API_KEY are required for the real Vision test.");

  const response = await fetch(`https://api.pexels.com/v1/photos/${candidateId}`, { headers: { Authorization: apiKey }, cache: "no-store" });
  if (!response.ok) throw new Error(`Pexels candidate lookup failed with status ${response.status}.`);
  const photo = await response.json() as { width: number; height: number; photographer: string; src: { original: string; large2x?: string; large?: string; medium?: string } };
  const originalHead = await fetch(photo.src.original, { method: "HEAD", cache: "no-store" });
  const originalBytes = Number(originalHead.headers.get("content-length") ?? 0);
  const normalized = await normalizeVisionImage({
    imageUrl: photo.src.original,
    providerUrls: [photo.src.large, photo.src.large2x, photo.src.medium].filter((url): url is string => Boolean(url)),
  });
  const scoringMetadata = await sharp(Buffer.from(normalized.imageUrl.split(",", 2)[1], "base64")).metadata();
  const score = await scoreImageWithVision({
    imageUrl: normalized.imageUrl,
    brief: {
      subject: "A polished product technology or software platform image for a professional company profile.",
      purpose: "contextual",
      placement: "column",
      aspectRatio: "16:9",
      moodKeywords: ["technical", "clear", "modern", "professional"],
    },
  });

  assert(typeof score.relevance === "number" && typeof score.composition === "number" && typeof score.textSafety === "number");
  console.log(JSON.stringify({
    candidateId: `pexels-${candidateId}`,
    source: "pexels",
    photographer: photo.photographer,
    originalBytes,
    originalWidth: photo.width,
    originalHeight: photo.height,
    originalContentType: originalHead.headers.get("content-type"),
    scoringSourceUrl: normalized.sourceUrl,
    scoringBytes: normalized.scoringBytes,
    scoringWidth: scoringMetadata.width,
    scoringHeight: scoringMetadata.height,
    scoringContentType: normalized.scoringContentType,
    score,
  }, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
