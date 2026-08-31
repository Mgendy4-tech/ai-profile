import assert from "node:assert/strict";
import { authoredDevelopmentFailureMessage, createAuthoredRejectionDiagnostic } from "./authored-export-diagnostics";
import { mustBlockLegacyFallback } from "./authored-export-policy";
import type { AuthoredExportDecision } from "./authored-templates/export-orchestrator";

const decision = {
  mode: "fallback", familyId: null, packId: "editorial-interiors-v1", pdf: null, pageOrder: null,
  reasons: [{ stage: "compatibility", code: "image_project_association_mismatch", path: "pages.3.hero", pageRole: "project_feature" }],
  ranking: { selectedFamilyId: "visual-portfolio", evaluations: [], eligibleFamilies: [], rejectedFamilies: [] },
} as unknown as Extract<AuthoredExportDecision, { mode: "fallback" }>;
const project = { id: "project:riverside", imageUrl: "data:image/jpeg;base64,QUJD" };
const before = JSON.stringify(decision);
const diagnostic = createAuthoredRejectionDiagnostic(decision, [project]);
assert.equal(JSON.stringify(decision), before, "Diagnostics must not mutate the authored decision.");
assert.equal(diagnostic.error.code, "image_project_association_mismatch");
assert.equal(diagnostic.authoredFamily, "visual-portfolio");
assert.equal(diagnostic.selectedPack, "editorial-interiors-v1");
assert.equal(diagnostic.preflightResult, "failed");
assert.equal(diagnostic.failingTemplateOrPage, "project_feature");
assert.deepEqual(diagnostic.images[0], { projectId: project.id, exists: true, sourceType: "data_url", mimeType: "image/jpeg", byteLength: 3, provenance: "user_upload", role: "project_image" });
assert.match(authoredDevelopmentFailureMessage(diagnostic), /^Authored export failed: image_project_association_mismatch/);
assert.equal(mustBlockLegacyFallback(1), true, "Diagnostics must not permit project-bearing legacy fallback.");
assert.equal(decision.mode, "fallback", "Diagnostics must not turn a rejection into authored success.");
console.log("Development authored-export diagnostics and fallback isolation tests passed.");
