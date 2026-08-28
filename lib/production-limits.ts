export const PRODUCTION_V1_LIMITS = Object.freeze({
  projects: 12,
  services: 12,
  features: 12,
  useCases: 9,
  pages: 16,
  imageBytes: 3 * 1024 * 1024,
  browserPersistedImageBytes: 3 * 1024 * 1024,
  totalImageBytes: 8 * 1024 * 1024,
  embeddedImageBytes: 8 * 1024 * 1024,
  imageDimensionPx: 12_000,
  generationRequestBytes: 256 * 1024,
  pdfBytes: 25 * 1024 * 1024,
});

export type OperationalLimitCode = "project_count_limit" | "image_format_limit" | "image_byte_limit" | "total_image_byte_limit" | "embedded_image_byte_limit" | "image_optimization_failed" | "image_dimension_limit" | "generation_request_limit" | "page_count_limit" | "pdf_byte_limit";
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
  if (total > PRODUCTION_V1_LIMITS.totalImageBytes) issues.push({ code: "total_image_byte_limit", path: "projects", message: "Combined source project images must be 8 MB or smaller." });
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
    issues.push({ code: "total_image_byte_limit", path: "company.logoUrl", message: "Combined source logo and project images must be 8 MB or smaller." });
  }
  return issues;
};

/** Counts the unique optimized data URLs that will actually be offered to jsPDF. Source/persistence limits are validated separately before optimization. */
export const validateAuthoredEmbeddedImageLimits = (
  company: { logoUrl?: string },
  projects: readonly { imageUrl: string }[],
): readonly OperationalLimitIssue[] => {
  const uniqueSources = new Set([
    ...(company.logoUrl ? [company.logoUrl] : []),
    ...projects.map((project) => project.imageUrl).filter(Boolean),
  ]);
  const embeddedBytes = [...uniqueSources].reduce((total, source) => total + dataUrlDecodedBytes(source), 0);
  return embeddedBytes > PRODUCTION_V1_LIMITS.embeddedImageBytes
    ? [{ code: "embedded_image_byte_limit", path: "document.images", message: "Optimized embedded images exceed the 8 MB export limit." }]
    : [];
};

export const validateGenerationRequestSize = (value: unknown): OperationalLimitIssue | null => new TextEncoder().encode(JSON.stringify(value)).byteLength > PRODUCTION_V1_LIMITS.generationRequestBytes ? { code: "generation_request_limit", path: "request", message: "This profile is too large to generate safely. Shorten the source content or remove optional sections." } : null;

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === "string" ? value : "";
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];

const modelCompany = (value: unknown) => {
  const company = record(value);
  return { name: text(company.name), about: text(company.about), companyType: text(company.companyType), industry: text(company.industry), customerType: text(company.customerType), servicesProducts: text(company.servicesProducts), activities: text(company.activities), experience: text(company.experience) };
};
const modelProjects = (value: unknown) => array(value).map((entry) => {
  const project = record(entry);
  return { name: text(project.name), category: text(project.category), description: text(project.description).slice(0, 500) };
});

/** Exact text-model input for structure analysis; embedded image bytes and browser state are intentionally excluded. */
export const createStructureAnalysisModelPayload = (value: unknown) => {
  const request = record(value);
  return { company: modelCompany(request.company), projects: modelProjects(request.projects) };
};

/** Exact text-model input for profile generation; source IDs and approved item identity are preserved. */
export const createProfileGenerationModelPayload = (value: unknown) => {
  const request = record(value);
  return {
    company: modelCompany(request.company),
    projects: modelProjects(request.projects),
    selectedSections: array(request.selectedSections).map((entry) => {
      const section = record(entry);
      return {
        id: text(section.id),
        displayTitle: text(section.displayTitle),
        description: text(section.description),
        ...(typeof section.semanticRole === "string" ? { semanticRole: section.semanticRole } : {}),
        ...(Array.isArray(section.items) ? { items: section.items.map((itemValue) => { const item = record(itemValue); return { id: text(item.id), title: text(item.title), description: text(item.description) }; }) } : {}),
      };
    }),
  };
};

export const validateRenderedDocumentLimits = (pageCount: number, pdfBytes: number): readonly OperationalLimitIssue[] => [
  ...(pageCount > PRODUCTION_V1_LIMITS.pages ? [{ code: "page_count_limit" as const, path: "document.pages", message: `V1 exports support at most ${PRODUCTION_V1_LIMITS.pages} pages.` }] : []),
  ...(pdfBytes > PRODUCTION_V1_LIMITS.pdfBytes ? [{ code: "pdf_byte_limit" as const, path: "document.bytes", message: "The generated PDF exceeds the 25 MB browser export limit." }] : []),
];
