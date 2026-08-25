import type { BrandAnalysis, PageCompositionDensity } from "./types";

export type PDFColor = readonly [number, number, number];
export type PDFFontStyle = "normal" | "bold" | "italic" | "bolditalic";
export type PDFPageMode = "light" | "dark" | "accent";

export type PDFTypographyRole = {
  fontSize: number;
  lineHeight: number;
  fontStyle: PDFFontStyle;
  uppercase: boolean;
};

export type PDFTypographyTokens = {
  display: PDFTypographyRole;
  h1: PDFTypographyRole;
  h2: PDFTypographyRole;
  h3: PDFTypographyRole;
  body: PDFTypographyRole;
  caption: PDFTypographyRole;
  overline: PDFTypographyRole;
};

export type PDFSpacingTokens = {
  xs: number;
  sm: number;
  md: number;
  lg: number;
  xl: number;
  sectionGap: number;
};

export type PDFDesignTokens = {
  page: {
    width: 210;
    height: 297;
    marginX: number;
    marginTop: number;
    marginBottom: number;
    baseline: number;
  };
  grid: {
    columns: 12;
    gutter: number;
  };
  typography: PDFTypographyTokens;
  spacing: PDFSpacingTokens;
  rules: {
    hairlineWidth: number;
    shortRuleWidth: number;
  };
  palette: {
    backgroundLight: PDFColor;
    backgroundDark: PDFColor;
    textOnLight: PDFColor;
    textOnDark: PDFColor;
    textMuted: PDFColor;
    accent: PDFColor;
    accentText: PDFColor;
    border: PDFColor;
    neutralPanel: PDFColor;
  };
};

export type PDFDensityAdjustments = {
  headingScale: number;
  bodyLeadingScale: number;
  spacingScale: number;
  mediaRatioScale: number;
};

export type ResolvedPDFPagePalette = {
  mode: PDFPageMode;
  background: PDFColor;
  primaryText: PDFColor;
  secondaryText: PDFColor;
  accent: PDFColor;
  divider: PDFColor;
  neutralPanel: PDFColor;
};

const FALLBACK_ACCENT: PDFColor = [17, 24, 39];
const TEXT_DARK: PDFColor = [17, 24, 39];
const TEXT_LIGHT: PDFColor = [255, 255, 255];

const BASE_TYPOGRAPHY: PDFTypographyTokens = {
  display: {
    fontSize: 25,
    lineHeight: 10,
    fontStyle: "bold",
    uppercase: false,
  },
  h1: {
    fontSize: 21,
    lineHeight: 8.2,
    fontStyle: "bold",
    uppercase: false,
  },
  h2: {
    fontSize: 14,
    lineHeight: 6.2,
    fontStyle: "bold",
    uppercase: false,
  },
  h3: {
    fontSize: 10.5,
    lineHeight: 5,
    fontStyle: "bold",
    uppercase: false,
  },
  body: {
    fontSize: 11.2,
    lineHeight: 6.2,
    fontStyle: "normal",
    uppercase: false,
  },
  caption: {
    fontSize: 9.3,
    lineHeight: 4.8,
    fontStyle: "normal",
    uppercase: false,
  },
  overline: {
    fontSize: 8.5,
    lineHeight: 4.2,
    fontStyle: "normal",
    uppercase: true,
  },
};

const BASE_SPACING: PDFSpacingTokens = {
  xs: 2.5,
  sm: 5,
  md: 8,
  lg: 12,
  xl: 18,
  sectionGap: 8,
};

const DENSITY_ADJUSTMENTS: Record<
  PageCompositionDensity,
  PDFDensityAdjustments
> = {
  minimal: {
    headingScale: 1.04,
    bodyLeadingScale: 1.08,
    spacingScale: 1.2,
    mediaRatioScale: 0.96,
  },
  balanced: {
    headingScale: 1,
    bodyLeadingScale: 1,
    spacingScale: 1,
    mediaRatioScale: 1,
  },
  rich: {
    headingScale: 0.96,
    bodyLeadingScale: 0.93,
    spacingScale: 0.72,
    mediaRatioScale: 1.04,
  },
};

const clampChannel = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value)));

export const normalizeAccentColor = (
  value: string | PDFColor | null | undefined
): PDFColor | null => {
  if (typeof value === "string") {
    const normalized = value.trim();

    if (!/^#[0-9a-f]{6}$/i.test(normalized)) {
      return null;
    }

    return [
      Number.parseInt(normalized.slice(1, 3), 16),
      Number.parseInt(normalized.slice(3, 5), 16),
      Number.parseInt(normalized.slice(5, 7), 16),
    ];
  }

  if (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((channel) => Number.isFinite(channel))
  ) {
    return [
      clampChannel(value[0]),
      clampChannel(value[1]),
      clampChannel(value[2]),
    ];
  }

  return null;
};

const relativeLuminance = (color: PDFColor) => {
  const channels = color.map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const contrastRatio = (first: PDFColor, second: PDFColor) => {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
};

export const chooseReadableTextColor = (background: PDFColor): PDFColor =>
  contrastRatio(background, TEXT_DARK) >= contrastRatio(background, TEXT_LIGHT)
    ? TEXT_DARK
    : TEXT_LIGHT;

export const resolveBrandAccent = (
  brandAnalysis: BrandAnalysis | null | undefined
): PDFColor => {
  for (const candidate of brandAnalysis?.logoColors ?? []) {
    const normalized = normalizeAccentColor(candidate);

    if (normalized) {
      return normalized;
    }
  }

  return FALLBACK_ACCENT;
};

export const createPDFDesignTokens = (
  brandAnalysis: BrandAnalysis | null | undefined
): PDFDesignTokens => {
  const accent = resolveBrandAccent(brandAnalysis);

  return {
    page: {
      width: 210,
      height: 297,
      marginX: 15,
      marginTop: 22,
      marginBottom: 16,
      baseline: 5.5,
    },
    grid: {
      columns: 12,
      gutter: 4,
    },
    typography: BASE_TYPOGRAPHY,
    spacing: BASE_SPACING,
    rules: {
      hairlineWidth: 0.4,
      shortRuleWidth: 24,
    },
    palette: {
      backgroundLight: [250, 249, 246],
      backgroundDark: [22, 29, 37],
      textOnLight: TEXT_DARK,
      textOnDark: TEXT_LIGHT,
      textMuted: [107, 114, 128],
      accent,
      accentText: chooseReadableTextColor(accent),
      border: [209, 213, 219],
      neutralPanel: [235, 232, 224],
    },
  };
};

export const resolveDensityAdjustments = (
  density: PageCompositionDensity
): PDFDensityAdjustments => ({ ...DENSITY_ADJUSTMENTS[density] });

const scaleTypographyRole = (
  role: PDFTypographyRole,
  fontScale: number,
  leadingScale: number
): PDFTypographyRole => ({
  ...role,
  fontSize: Number((role.fontSize * fontScale).toFixed(2)),
  lineHeight: Number((role.lineHeight * leadingScale).toFixed(2)),
});

export const resolveTypographyForDensity = (
  tokens: PDFDesignTokens,
  density: PageCompositionDensity
): PDFTypographyTokens => {
  const adjustments = resolveDensityAdjustments(density);

  return {
    display: scaleTypographyRole(
      tokens.typography.display,
      adjustments.headingScale,
      adjustments.headingScale
    ),
    h1: scaleTypographyRole(
      tokens.typography.h1,
      adjustments.headingScale,
      adjustments.headingScale
    ),
    h2: scaleTypographyRole(
      tokens.typography.h2,
      adjustments.headingScale,
      adjustments.headingScale
    ),
    h3: scaleTypographyRole(
      tokens.typography.h3,
      adjustments.headingScale,
      adjustments.headingScale
    ),
    body: scaleTypographyRole(
      tokens.typography.body,
      1,
      adjustments.bodyLeadingScale
    ),
    caption: scaleTypographyRole(
      tokens.typography.caption,
      1,
      adjustments.bodyLeadingScale
    ),
    overline: { ...tokens.typography.overline },
  };
};

export const resolveSpacingForDensity = (
  tokens: PDFDesignTokens,
  density: PageCompositionDensity
): PDFSpacingTokens => {
  const scale = resolveDensityAdjustments(density).spacingScale;
  const scaleValue = (value: number) => Number((value * scale).toFixed(2));

  return {
    xs: scaleValue(tokens.spacing.xs),
    sm: scaleValue(tokens.spacing.sm),
    md: scaleValue(tokens.spacing.md),
    lg: scaleValue(tokens.spacing.lg),
    xl: scaleValue(tokens.spacing.xl),
    sectionGap: scaleValue(tokens.spacing.sectionGap),
  };
};

export const resolvePagePalette = (
  tokens: PDFDesignTokens,
  mode: PDFPageMode
): ResolvedPDFPagePalette => {
  if (mode === "dark") {
    return {
      mode,
      background: tokens.palette.backgroundDark,
      primaryText: tokens.palette.textOnDark,
      secondaryText: [209, 213, 219],
      accent: tokens.palette.accent,
      divider: [75, 85, 99],
      neutralPanel: [31, 41, 55],
    };
  }

  if (mode === "accent") {
    return {
      mode,
      background: tokens.palette.accent,
      primaryText: tokens.palette.accentText,
      secondaryText: tokens.palette.accentText,
      accent: tokens.palette.accentText,
      divider: tokens.palette.accentText,
      neutralPanel: tokens.palette.accent,
    };
  }

  return {
    mode,
    background: tokens.palette.backgroundLight,
    primaryText: tokens.palette.textOnLight,
    secondaryText: tokens.palette.textMuted,
    accent: tokens.palette.accent,
    divider: tokens.palette.border,
    neutralPanel: tokens.palette.neutralPanel,
  };
};
