import assert from "node:assert/strict";
import { normalizeAuthoredVariant, authoredVariants, recommendAuthoredVariant, variantsForFamily } from "./variant-registry";

const signals = (overrides: Partial<Parameters<typeof recommendAuthoredVariant>[1]> = {}) => ({
  projectCount: 1,
  authenticProjectImageCount: 1,
  serviceCount: 7,
  corporateDetailCount: 2,
  productFeatureCount: 7,
  useCaseCount: 3,
  narrativeCharacterCount: 240,
  ...overrides,
});

assert.equal(authoredVariants.length, 6, "V1 must register exactly six authored variants.");
for (const familyId of ["visual-portfolio", "corporate-services", "product-tech"] as const) {
  assert.equal(variantsForFamily(familyId).length, 2, `${familyId} must expose exactly two styles.`);
  assert(variantsForFamily(familyId).every((variant) => variant.familyId === familyId && variant.available && variant.rendererKey === variant.id), `${familyId} styles must remain registered, available, and renderer-mapped.`);
}

assert.equal(recommendAuthoredVariant("visual-portfolio", signals()).variantId, "visual-editorial", "A focused Aurelia-style portfolio must recommend Editorial Narrative.");
assert.equal(recommendAuthoredVariant("visual-portfolio", signals({ projectCount: 3, authenticProjectImageCount: 3 })).variantId, "visual-gallery", "A multi-image portfolio must recommend Gallery Focus.");
assert.equal(recommendAuthoredVariant("corporate-services", signals()).variantId, "corporate-structured", "A service-rich company must recommend Structured Grid.");
assert.equal(recommendAuthoredVariant("product-tech", signals()).variantId, "product-system", "A feature-rich product must recommend System Features.");

assert.equal(normalizeAuthoredVariant("visual-portfolio", "visual-gallery", signals()).variantId, "visual-gallery", "A valid same-family manual override must persist.");
assert.equal(normalizeAuthoredVariant("visual-portfolio", "corporate-structured", signals()).variantId, "visual-editorial", "A cross-family style must normalize to the active family recommendation.");
assert.equal(normalizeAuthoredVariant("product-tech", "stale-style", signals()).variantId, "product-system", "An invalid style must normalize deterministically.");

console.log("Authored variant registry, recommendation, override, and normalization tests passed.");
