export type GenerationOperation = "analysis" | "generation";

const generationMessages = [
  "Analyzing your company information…",
  "Building your profile structure…",
  "Generating professional content…",
  "Preparing the best document layout…",
  "Finalizing your profile…",
] as const;

export const generationProgressMessage = (operation: GenerationOperation, elapsedSeconds: number) => {
  if (operation === "analysis") return elapsedSeconds >= 45
    ? "Still analyzing your company information…"
    : "Analyzing your company information…";
  if (elapsedSeconds >= 150) return "Almost there — your profile is being finalized.";
  const index = Math.min(generationMessages.length - 1, Math.floor(Math.max(0, elapsedSeconds) / 30));
  return generationMessages[index];
};

export const createGenerationAttemptGuard = () => {
  let active = false;
  return {
    tryStart: () => active ? false : (active = true),
    finish: () => { active = false; },
    isActive: () => active,
  };
};
