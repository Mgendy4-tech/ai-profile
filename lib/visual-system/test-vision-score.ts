import { searchPexelsImages } from "./image-source";
import { scoreImageWithVision } from "./vision-score";

const run = async () => {
  const images = await searchPexelsImages(
    "luxury interior design marble",
    1
  );

  const image = images[0];

  if (!image) {
    throw new Error("No Pexels image returned.");
  }

  const result = await scoreImageWithVision({
    imageUrl: image.url,
    brief: {
      subject:
        "Luxury interior material detail featuring premium marble or natural stone in a refined architectural setting.",
      purpose: "hero",
      placement: "full_bleed",
      aspectRatio: "16:9",
      moodKeywords: [
        "luxury",
        "warm",
        "premium",
        "architectural",
        "editorial",
      ],
    },
  });

  console.log("Image:");
  console.log({
    id: image.candidateId,
    photographer: image.photographer,
    width: image.width,
    height: image.height,
    url: image.url,
  });

  console.log("\nVision score:");
  console.log(result);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});