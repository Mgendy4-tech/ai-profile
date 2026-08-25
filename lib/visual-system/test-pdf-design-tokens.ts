import {
  chooseReadableTextColor,
  createPDFDesignTokens,
  normalizeAccentColor,
  resolveBrandAccent,
  resolveDensityAdjustments,
  resolvePagePalette,
  resolveSpacingForDensity,
  resolveTypographyForDensity,
  type PDFPageMode,
} from "./pdf-design-tokens";
import type { BrandAnalysis, PageCompositionDensity } from "./types";

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const brand: BrandAnalysis = {
  logoColors: ["not-a-color", "#D9B26F"],
  colorStrategy: "respect_logo",
  interpretedMood: "warm",
  designStyle: "minimal",
  energyLevel: 0.4,
  confidence: 0.9,
};
const tokens = createPDFDesignTokens(brand);
const repeatedTokens = createPDFDesignTokens(brand);

assert(
  JSON.stringify(tokens) === JSON.stringify(repeatedTokens),
  "Identical inputs must produce stable design tokens."
);
assert(
  tokens.page.width === 210 &&
    tokens.page.height === 297 &&
    tokens.page.marginX * 2 < tokens.page.width &&
    tokens.page.marginTop + tokens.page.marginBottom < tokens.page.height,
  "Page tokens must describe bounded A4 geometry."
);
assert(
  tokens.grid.columns === 12 && tokens.grid.gutter > 0,
  "The deterministic grid must be valid."
);

const typographyRoles = [
  "display",
  "h1",
  "h2",
  "h3",
  "body",
  "caption",
  "overline",
] as const;
typographyRoles.forEach((role) => {
  const value = tokens.typography[role];
  assert(
    value.fontSize > 0 && value.lineHeight > 0 && Boolean(value.fontStyle),
    `${role} must contain jsPDF-safe typography values.`
  );
});

assert(
  tokens.typography.display.fontSize > tokens.typography.h1.fontSize &&
    tokens.typography.h1.fontSize > tokens.typography.h2.fontSize &&
    tokens.typography.h2.fontSize > tokens.typography.body.fontSize &&
    tokens.typography.body.fontSize > tokens.typography.caption.fontSize,
  "Typography roles must form a coherent hierarchy."
);

const densities: PageCompositionDensity[] = ["minimal", "balanced", "rich"];
densities.forEach((density) => {
  const typography = resolveTypographyForDensity(tokens, density);
  const spacing = resolveSpacingForDensity(tokens, density);
  const adjustments = resolveDensityAdjustments(density);

  assert(
    typography.display.fontSize > 0 &&
      typography.body.lineHeight > 0 &&
      spacing.sectionGap > 0 &&
      adjustments.mediaRatioScale > 0,
    `${density} density must resolve valid deterministic adjustments.`
  );
});
assert(
  resolveSpacingForDensity(tokens, "minimal").sectionGap >
    resolveSpacingForDensity(tokens, "balanced").sectionGap &&
    resolveSpacingForDensity(tokens, "balanced").sectionGap >
      resolveSpacingForDensity(tokens, "rich").sectionGap,
  "Density must produce descending whitespace from minimal to rich."
);
assert(
  resolveDensityAdjustments("minimal").mediaRatioScale <
    resolveDensityAdjustments("balanced").mediaRatioScale &&
    resolveDensityAdjustments("balanced").mediaRatioScale <
      resolveDensityAdjustments("rich").mediaRatioScale,
  "Density must adjust media-to-content ratio through a bounded deterministic scale."
);

const modes: PDFPageMode[] = ["light", "dark", "accent"];
modes.forEach((mode) => {
  const palette = resolvePagePalette(tokens, mode);
  [
    palette.background,
    palette.primaryText,
    palette.secondaryText,
    palette.accent,
    palette.divider,
    palette.neutralPanel,
  ].forEach((color) => {
    assert(
      color.length === 3 &&
        color.every((channel) => channel >= 0 && channel <= 255),
      `${mode} palette must contain valid RGB colors.`
    );
  });
});

assert(
  chooseReadableTextColor([255, 255, 255]).join(",") === "17,24,39" &&
    chooseReadableTextColor([0, 0, 0]).join(",") === "255,255,255",
  "Readable text selection must handle light and dark backgrounds."
);
assert(
  resolveBrandAccent(brand).join(",") === "217,178,111" &&
    resolveBrandAccent(null).join(",") === "17,24,39",
  "Brand accents must normalize valid colors and use the neutral fallback."
);
assert(
  normalizeAccentColor("#ffffff")?.join(",") === "255,255,255" &&
    normalizeAccentColor("invalid") === null,
  "Accent normalization must accept only safe six-digit hex values."
);

console.log("PDF design token tests passed.");
