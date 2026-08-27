import { strict as assert } from "node:assert";
import { createGenerationAttemptGuard, generationProgressMessage } from "./generation-progress";

assert.equal(generationProgressMessage("analysis", 0), "Analyzing your company information…");
assert.equal(generationProgressMessage("generation", 0), "Analyzing your company information…");
assert.equal(generationProgressMessage("generation", 31), "Building your profile structure…");
assert.equal(generationProgressMessage("generation", 61), "Generating professional content…");
assert.equal(generationProgressMessage("generation", 91), "Preparing the best document layout…");
assert.equal(generationProgressMessage("generation", 121), "Finalizing your profile…");
assert.equal(generationProgressMessage("generation", 151), "Almost there — your profile is being finalized.");
const guard = createGenerationAttemptGuard();
assert.equal(guard.tryStart(), true);
assert.equal(guard.tryStart(), false, "A second generation attempt must be rejected while the first is active.");
guard.finish();
assert.equal(guard.tryStart(), true, "Retry must be available after completion or failure.");
guard.finish();
console.log("Generation progress messaging and duplicate-request guard tests passed.");
