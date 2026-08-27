import { formatPDFImageCredits, resolvePDFCreditPlacement } from "./pdf-image-credits";

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};
const credits = ["one", "two", "three"].map((briefId, index) => ({
  briefId,
  purpose: index === 0 ? "hero" : "contextual",
  photographer: `Photographer ${index + 1}`,
  source: "pexels",
}));
const appended = resolvePDFCreditPlacement({ credits, contentBottom: 220, pageTop: 22, safeBottom: 278 });
assert(appended?.mode === "append" && appended.bottom <= 278, "Compact credits should append only when safe.");
assert(appended?.lines.length === credits.length, "Appending must preserve every attribution.");
const overflow = resolvePDFCreditPlacement({ credits, contentBottom: 265, pageTop: 22, safeBottom: 278 });
assert(overflow?.mode === "dedicated", "Overflow must retain a dedicated credits page.");
assert(overflow?.lines.length === credits.length, "Dedicated fallback must preserve every attribution.");
assert(
  JSON.stringify(appended) === JSON.stringify(resolvePDFCreditPlacement({ credits, contentBottom: 220, pageTop: 22, safeBottom: 278 })),
  "Credit placement must be deterministic."
);
assert(formatPDFImageCredits(credits).every((line) => line.includes("Pexels")), "Source attribution must remain complete.");
console.log("PDF image-credit tests passed.");
