export const PRODUCTION_V1_LIMITS = Object.freeze({
  projects: 12,
  services: 12,
  features: 12,
  useCases: 9,
  pages: 16,
  imageBytes: 3 * 1024 * 1024,
  browserPersistedImageBytes: 3 * 1024 * 1024,
  totalImageBytes: 8 * 1024 * 1024,
  imageDimensionPx: 12_000,
  generationRequestBytes: 256 * 1024,
  pdfBytes: 25 * 1024 * 1024,
});

export type OperationalLimitCode = "project_count_limit" | "image_format_limit" | "image_byte_limit" | "total_image_byte_limit" | "image_dimension_limit" | "generation_request_limit" | "page_count_limit" | "pdf_byte_limit";
export type OperationalLimitIssue = { code: OperationalLimitCode; path: string; message: string };

export const dataUrlDecodedBytes = (source: string) => {
  const comma = source.indexOf(",");
  if (comma < 0) return Number.POSITIVE_INFINITY;
  const payload = source.slice(comma + 1).replace(/\s/g, "");
  return Math.max(0, Math.floor(payload.length * 3 / 4) - (payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0));
};

export const validateProjectOperationalLimits = (projects: readonly { imageUrl: string }[]): readonly OperationalLimitIssue[] => {
  const issues: OperationalLimitIssue[] = [];
  if (projects.length > PRODUCTION_V1_LIMITS.projects) issues.push({ code: "project_count_limit", path: "projects", message: `V1 supports at most ${PRODUCTION_V1_LIMITS.projects} projects.` });
  let total = 0;
  projects.forEach((project, index) => {
    if (!project.imageUrl) return;
    if (!/^data:image\/(png|jpe?g);base64,/i.test(project.imageUrl)) issues.push({ code: "image_format_limit", path: `projects.${index}.imageUrl`, message: "Project images must be PNG or JPEG files." });
    const bytes = dataUrlDecodedBytes(project.imageUrl); total += bytes;
    if (bytes > PRODUCTION_V1_LIMITS.imageBytes) issues.push({ code: "image_byte_limit", path: `projects.${index}.imageUrl`, message: "Each project image must be 3 MB or smaller." });
  });
  if (total > PRODUCTION_V1_LIMITS.totalImageBytes) issues.push({ code: "total_image_byte_limit", path: "projects", message: "Combined embedded project images must be 8 MB or smaller." });
  return issues;
};

export const validateAuthoredImageOperationalLimits = (
  company: { logoUrl?: string },
  projects: readonly { imageUrl: string }[],
): readonly OperationalLimitIssue[] => {
  const issues = [...validateProjectOperationalLimits(projects)];
  if (!company.logoUrl) return issues;
  if (!/^data:image\/(png|jpe?g);base64,/i.test(company.logoUrl)) {
    issues.push({ code: "image_format_limit", path: "company.logoUrl", message: "Company logos must be PNG or JPEG files." });
  }
  const logoBytes = dataUrlDecodedBytes(company.logoUrl);
  if (logoBytes > PRODUCTION_V1_LIMITS.imageBytes) {
    issues.push({ code: "image_byte_limit", path: "company.logoUrl", message: "The company logo must be 3 MB or smaller." });
  }
  const projectBytes = projects.reduce((total, project) => total + (project.imageUrl ? dataUrlDecodedBytes(project.imageUrl) : 0), 0);
  if (logoBytes + projectBytes > PRODUCTION_V1_LIMITS.totalImageBytes && !issues.some((entry) => entry.code === "total_image_byte_limit")) {
    issues.push({ code: "total_image_byte_limit", path: "company.logoUrl", message: "Combined embedded logo and project images must be 8 MB or smaller." });
  }
  return issues;
};

export const validateGenerationRequestSize = (value: unknown): OperationalLimitIssue | null => new TextEncoder().encode(JSON.stringify(value)).byteLength > PRODUCTION_V1_LIMITS.generationRequestBytes ? { code: "generation_request_limit", path: "request", message: "This profile is too large to generate safely. Shorten the source content or remove optional sections." } : null;

export const validateRenderedDocumentLimits = (pageCount: number, pdfBytes: number): readonly OperationalLimitIssue[] => [
  ...(pageCount > PRODUCTION_V1_LIMITS.pages ? [{ code: "page_count_limit" as const, path: "document.pages", message: `V1 exports support at most ${PRODUCTION_V1_LIMITS.pages} pages.` }] : []),
  ...(pdfBytes > PRODUCTION_V1_LIMITS.pdfBytes ? [{ code: "pdf_byte_limit" as const, path: "document.bytes", message: "The generated PDF exceeds the 25 MB browser export limit." }] : []),
];
