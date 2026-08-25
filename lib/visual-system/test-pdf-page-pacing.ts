import { resolvePDFPageMode } from "./pdf-page-pacing";
import { createPDFDesignTokens, resolvePagePalette } from "./pdf-design-tokens";

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const inputs = [
  {
    pageIndex: 0,
    pageRole: "cover" as const,
    density: "minimal" as const,
    hasImage: true,
    previousMode: null,
  },
  {
    pageIndex: 1,
    pageRole: "introduction" as const,
    density: "balanced" as const,
    hasImage: true,
    previousMode: "dark" as const,
  },
  {
    pageIndex: 2,
    pageRole: "narrative" as const,
    density: "balanced" as const,
    hasImage: false,
    previousMode: "light" as const,
  },
  {
    pageIndex: 3,
    pageRole: "narrative" as const,
    density: "balanced" as const,
    hasImage: false,
    previousMode: "dark" as const,
  },
];
const modes = inputs.map(resolvePDFPageMode);
assert(
  modes.join(",") === "dark,light,dark,accent",
  "Page pacing should produce deterministic dark/light/accent rhythm."
);
assert(
  JSON.stringify(inputs.map(resolvePDFPageMode)) === JSON.stringify(modes),
  "Page pacing must be stable for identical input."
);
assert(
  resolvePDFPageMode({
    pageIndex: 3,
    pageRole: "narrative",
    density: "rich",
    hasImage: false,
    previousMode: "accent",
  }) === "light",
  "Rich pages should prefer the most readable light mode."
);
assert(
  resolvePDFPageMode({
    pageIndex: 0,
    pageRole: "cover",
    density: "minimal",
    hasImage: false,
    previousMode: null,
  }) === "accent",
  "Image-free covers should use an intentional accent mode."
);

const tokens = createPDFDesignTokens({
  logoColors: ["#111827"],
  colorStrategy: "respect_logo",
  interpretedMood: "neutral",
  designStyle: "minimal",
  energyLevel: 0.5,
  confidence: 1,
});
["dark", "accent"].forEach((mode) => {
  const palette = resolvePagePalette(tokens, mode as "dark" | "accent");
  assert(
    palette.primaryText.join(",") === "255,255,255",
    `${mode} mode should resolve a readable foreground for the dark brand.`
  );
});

console.log("PDF page pacing tests passed.");
