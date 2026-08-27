import type jsPDF from "jspdf";

export const PDF_EDITORIAL_TYPE_CONSTRAINTS = {
  minimumBodyFontSize: 9.5,
  minimumProjectDescriptionFontSize: 9.5,
  bodyLineLength: { min: 36, max: 78 },
  paragraphLeading: { min: 1.42, max: 1.75 },
  headingToRuleClearance: 2.5,
  ruleToBodyClearance: 5,
  subsectionSpacing: 6,
  paragraphSpacing: 5,
} as const;

export type WordAwareTitleFit = {
  fontSize: number;
  lines: string[];
  lineHeight: number;
};

const normalizeWords = (value: string) => value.trim().split(/\s+/).filter(Boolean);

const partitions = (words: readonly string[], lineCount: number) => {
  const results: string[][] = [];
  const visit = (start: number, remaining: number, lines: string[]) => {
    if (remaining === 1) {
      if (start < words.length) results.push([...lines, words.slice(start).join(" ")]);
      return;
    }
    const lastBreak = words.length - remaining + 1;
    for (let end = start + 1; end <= lastBreak; end += 1) {
      visit(end, remaining - 1, [...lines, words.slice(start, end).join(" ")]);
    }
  };
  visit(0, lineCount, []);
  return results;
};

export const fitWordAwareDisplayTitle = (
  pdf: jsPDF,
  title: string,
  options: {
    maxWidth: number;
    maxHeight: number;
    approvedSizes: readonly number[];
    fallbackSizes?: readonly number[];
    minLines?: number;
    maxLines?: number;
  }
): WordAwareTitleFit | null => {
  const words = normalizeWords(title);
  if (!words.length) return null;

  const sizes = [...new Set([
    ...options.approvedSizes,
    ...(options.fallbackSizes ?? [40, 36, 32]),
  ])].sort((a, b) => b - a);
  const minimumLines = words.length === 1 ? 1 : options.minLines ?? 2;
  const maximumLines = Math.min(options.maxLines ?? 4, words.length);

  for (const fontSize of sizes) {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(fontSize);
    if (words.some((word) => pdf.getTextWidth(word) > options.maxWidth)) continue;

    const lineHeight = fontSize * 0.352778 * 1.12;
    for (let lineCount = minimumLines; lineCount <= maximumLines; lineCount += 1) {
      if (lineCount * lineHeight > options.maxHeight) continue;
      const candidates = partitions(words, lineCount)
        .map((lines) => ({ lines, widths: lines.map((line) => pdf.getTextWidth(line)) }))
        .filter(({ widths }) => widths.every((width) => width <= options.maxWidth))
        .map(({ lines, widths }) => {
          const average = widths.reduce((sum, width) => sum + width, 0) / widths.length;
          const imbalance = widths.reduce((sum, width) => sum + (width - average) ** 2, 0);
          const finalWords = lines.at(-1)!.split(/\s+/);
          const orphanPenalty = finalWords.length === 1 && finalWords[0].length <= 5
            ? options.maxWidth ** 2
            : 0;
          return { lines, score: imbalance + orphanPenalty };
        })
        .sort((a, b) => a.score - b.score || a.lines.join("\n").localeCompare(b.lines.join("\n")));

      if (candidates[0]) return { fontSize, lines: candidates[0].lines, lineHeight };
    }
  }

  return null;
};
