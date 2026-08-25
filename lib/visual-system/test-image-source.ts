import { searchPexelsImages } from "./image-source";

const run = async () => {
  const images = await searchPexelsImages(
    "luxury interior design marble",
    5
  );

  console.log(
    images.map((image) => ({
      id: image.candidateId,
      photographer: image.photographer,
      width: image.width,
      height: image.height,
      url: image.url,
    }))
  );
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});