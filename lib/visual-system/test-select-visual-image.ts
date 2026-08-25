import { selectVisualImage } from "./select-visual-image";

const run = async () => {
  const searchAttempts: {
    attempt: number;
    query: string;
    orientation: string;
  }[] = [];

  const result = await selectVisualImage(
    {
      id: "cover_hero",
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
    {
      candidateCount: 3,
      onSearchAttempt: (attempt) => {
        searchAttempts.push(attempt);
      },
    }
  );

  console.log("\nPexels search attempts:");
  console.table(searchAttempts);

  console.log("\nProduction visual selection result:");
  console.dir(result, {
    depth: null,
  });
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
