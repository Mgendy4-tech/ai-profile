export type ProductionSectionRole = "narrative" | "services" | "projects" | "features" | "use_cases";

export type ProductionSectionForNormalization = {
  id: string;
  title: string;
  description: string;
  content: string;
  items: readonly { name: string; description: string; imageUrl?: string }[];
};

export type SectionRoleDiagnosticCode =
  | "unknown_semantic_role"
  | "ambiguous_semantic_role"
  | "duplicate_role_candidate";

export type SectionRoleDiagnostic = {
  code: SectionRoleDiagnosticCode;
  path: string;
  sectionId: string;
  role: ProductionSectionRole | null;
};

export type SectionRoleNormalizationResult = {
  sections: readonly { section: ProductionSectionForNormalization; role: ProductionSectionRole }[];
  diagnostics: readonly SectionRoleDiagnostic[];
};

const ROLE_TOKENS: Readonly<Record<ProductionSectionRole, readonly string[]>> = {
  narrative: ["about", "overview", "companyprofile", "ourstory"],
  services: ["services", "capabilities", "expertise", "mainactivities", "activities"],
  projects: ["projects", "portfolio", "featuredprojects", "casestudies"],
  features: ["features", "productfeatures", "platformfeatures", "functionality"],
  use_cases: ["usecases", "applications", "productapplications"],
};

const PRODUCT_TECH_TYPE_TOKENS = ["saas", "software", "technology", "techcompany", "platform", "aicompany", "artificialintelligence", "digitalproduct", "productcompany"] as const;
const SERVICE_BUSINESS_TYPE_TOKENS = ["consulting", "services", "advisory", "agency"] as const;
export const isProductTechCompanyType = (companyType: string) => {
  const normalized = normalizeId(companyType);
  if (PRODUCT_TECH_TYPE_TOKENS.some((token) => normalized.includes(token))) return true;
  return normalized.includes("automation") &&
    normalized.includes("product") &&
    !SERVICE_BUSINESS_TYPE_TOKENS.some((token) => normalized.includes(token));
};

const normalizeId = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");

export const normalizeProductionSectionRoles = (
  sections: readonly ProductionSectionForNormalization[],
  options: { productTech?: boolean } = {},
): SectionRoleNormalizationResult => {
  const normalized: { section: ProductionSectionForNormalization; role: ProductionSectionRole }[] = [];
  const diagnostics: SectionRoleDiagnostic[] = [];
  const roleOwners = new Map<ProductionSectionRole, string>();

  sections.forEach((section, index) => {
    const id = normalizeId(section.id);
    const matches = (Object.entries(ROLE_TOKENS) as [ProductionSectionRole, readonly string[]][])
      .filter(([, tokens]) => tokens.some((token) => id === token || id.includes(token)))
      .map(([role]) => role);
    if (matches.length === 0) {
      diagnostics.push({ code: "unknown_semantic_role", path: `sections.${index}.id`, sectionId: section.id, role: null });
      return;
    }
    if (matches.length > 1) {
      diagnostics.push({ code: "ambiguous_semantic_role", path: `sections.${index}.id`, sectionId: section.id, role: null });
      return;
    }
    const role = options.productTech && matches[0] === "services" ? "features" : matches[0];
    if (roleOwners.has(role)) {
      diagnostics.push({ code: "duplicate_role_candidate", path: `sections.${index}.id`, sectionId: section.id, role });
      return;
    }
    roleOwners.set(role, section.id);
    normalized.push({ section, role });
  });

  return { sections: normalized, diagnostics };
};
