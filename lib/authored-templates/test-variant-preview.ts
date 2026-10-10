import assert from "node:assert/strict";
import { authoredVariants, variantsForFamily } from "./variant-registry";
import { authoredVariantPreviews, getAuthoredVariantPreview, previewSignature } from "./variant-preview";

assert.deepEqual(
  authoredVariantPreviews.map((preview) => preview.variantId),
  authoredVariants.map((variant) => variant.id),
  "Every canonical authored variant must have exactly one preview definition in registry order.",
);

for (const familyId of ["visual-portfolio", "corporate-services", "product-tech"] as const) {
  const variants = variantsForFamily(familyId);
  const previews = variants.map((variant) => getAuthoredVariantPreview(variant.id));
  assert.equal(previews.length, 2, `${familyId} must expose two live previews.`);
  assert.notEqual(previewSignature(previews[0]), previewSignature(previews[1]), `${familyId} variants must have visibly distinct mini-layouts.`);
  for (const preview of previews) {
    assert(preview.rhythm && preview.imageEmphasis && preview.textDensity && preview.balance && preview.accentTreatment && preview.bestFor, `${preview.variantId} preview must describe its visual intent.`);
    assert(preview.blocks.length >= 3, `${preview.variantId} preview must contain a compact composition.`);
    assert(preview.blocks.every((block) => ["image", "text", "card", "accent"].includes(block.kind) && ["short", "medium", "tall", "wide"].includes(block.size)), `${preview.variantId} preview contains an invalid block token.`);
  }
}

console.log("Authored variant preview registry maps six canonical variants to distinct deterministic mini-layouts.");
