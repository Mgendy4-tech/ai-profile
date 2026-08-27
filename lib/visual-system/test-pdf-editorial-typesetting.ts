import jsPDF from "jspdf";
import {
  PDF_EDITORIAL_TYPE_CONSTRAINTS,
  fitWordAwareDisplayTitle,
} from "./pdf-editorial-typesetting";

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};
const pdf = new jsPDF({ unit: "mm", format: "a4" });
const fit = (title: string) => fitWordAwareDisplayTitle(pdf, title, {
  maxWidth: 72,
  maxHeight: 90,
  approvedSizes: [44, 52, 60, 72],
  fallbackSizes: [40, 36, 32],
  minLines: 2,
  maxLines: 4,
});

[
  "Aurelia Interior Studio",
  "International Architectural Design Studio",
].forEach((title) => {
  const result = fit(title);
  assert(Boolean(result), `${title} should fit without fragmenting words.`);
  assert(result!.lines.join(" ") === title, "The complete company name must be preserved.");
  assert(
    result!.lines.flatMap((line) => line.split(/\s+/)).join("|") === title.split(/\s+/).join("|"),
    "Display wrapping must occur only at whitespace boundaries."
  );
  assert(JSON.stringify(result) === JSON.stringify(fit(title)), "Title fitting must be deterministic.");
});
assert(
  fit("SupercalifragilisticexpialidociousArchitecturalCollective") === null,
  "An unbreakable title that cannot fit must preserve the safe fallback path."
);
assert(
  PDF_EDITORIAL_TYPE_CONSTRAINTS.minimumBodyFontSize >= 9.5,
  "Approved body text must not become tiny."
);
console.log("PDF editorial typesetting tests passed.");
