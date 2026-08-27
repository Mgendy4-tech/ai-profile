export type PDFImageCredit = {
  briefId: string;
  purpose: string;
  photographer: string | null;
  source: string | null;
};

export type PDFCreditPlacement = {
  mode: "append" | "dedicated";
  startY: number;
  lines: string[];
  bottom: number;
};

export const formatPDFImageCredits = (
  credits: readonly PDFImageCredit[]
): string[] => credits.map((credit) => {
  const photographer = credit.photographer?.trim() || "Pexels contributor";
  const source = credit.source === "pexels" || !credit.source ? "Pexels" : credit.source;
  return `${credit.purpose}: Photo by ${photographer} — ${source}`;
});

export const resolvePDFCreditPlacement = (input: {
  credits: readonly PDFImageCredit[];
  contentBottom: number;
  pageTop: number;
  safeBottom: number;
  separation?: number;
  headingHeight?: number;
  lineHeight?: number;
}): PDFCreditPlacement | null => {
  const lines = formatPDFImageCredits(input.credits);
  if (!lines.length) return null;
  const separation = input.separation ?? 10;
  const headingHeight = input.headingHeight ?? 8;
  const lineHeight = input.lineHeight ?? 5;
  const height = headingHeight + lines.length * lineHeight;
  const appendStart = input.contentBottom + separation;
  const appendBottom = appendStart + height;
  if (appendBottom <= input.safeBottom) {
    return { mode: "append", startY: appendStart, lines, bottom: appendBottom };
  }
  const dedicatedStart = input.pageTop;
  return {
    mode: "dedicated",
    startY: dedicatedStart,
    lines,
    bottom: dedicatedStart + height,
  };
};
