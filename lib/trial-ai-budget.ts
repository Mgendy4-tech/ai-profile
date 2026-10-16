export type TrialBudgetResult = { data: unknown; error: unknown };
export async function reserveTrialAiRequest(reserve: () => PromiseLike<TrialBudgetResult>): Promise<"allowed" | "limited" | "unavailable"> {
  try {
    const result = await reserve();
    if (result.error || typeof result.data !== "boolean") return "unavailable";
    return result.data ? "allowed" : "limited";
  } catch {
    return "unavailable";
  }
}
