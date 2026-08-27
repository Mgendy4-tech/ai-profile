export type SelectedProfileSection = {
  id: string;
  displayTitle: string;
  description: string;
  semanticRole?: string;
  items?: readonly ApprovedProfileItem[];
};

export type ApprovedProfileItem = { id: string; title: string; description: string };

export type GeneratedProfileItem = {
  id?: string;
  name: string;
  description: string;
  sourceEvidence?: string;
  imageUrl?: string;
};

export type GeneratedProfileSection = {
  id: string;
  title: string;
  description: string;
  content: string;
  items: GeneratedProfileItem[];
};

export type GeneratedSectionDiagnosticCode =
  | "generated_sections_invalid_shape"
  | "generated_section_duplicate_id"
  | "generated_section_unknown_id"
  | "generated_section_missing_id"
  | "generated_section_title_mismatch"
  | "generated_services_items_required"
  | "generated_services_count_unsupported"
  | "generated_service_item_invalid"
  | "generated_service_item_duplicate_id"
  | "generated_service_item_unstable_id"
  | "generated_service_item_title_capacity_unsupported"
  | "generated_service_item_evidence_unsupported"
  | "generated_product_items_required"
  | "generated_product_item_count_unsupported"
  | "generated_product_item_invalid"
  | "generated_product_item_duplicate_id"
  | "generated_product_item_unstable_id"
  | "generated_product_item_title_capacity_unsupported"
  | "generated_product_item_evidence_unsupported"
  | "generated_product_content_capacity_unsupported";

export type GeneratedSectionDiagnostic = {
  code: GeneratedSectionDiagnosticCode;
  sectionId: string | null;
  path: string;
};

export type GeneratedSectionsValidationResult =
  | { valid: true; sections: GeneratedProfileSection[]; diagnostics: [] }
  | { valid: false; sections: null; diagnostics: GeneratedSectionDiagnostic[] };

const isGeneratedItem = (value: unknown): value is GeneratedProfileItem => {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (item.id === undefined || typeof item.id === "string") &&
    typeof item.name === "string" && typeof item.description === "string" &&
    (item.sourceEvidence === undefined || typeof item.sourceEvidence === "string") &&
    (item.imageUrl === undefined || typeof item.imageUrl === "string");
};

const normalizeToken = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "");
const SERVICE_ROLE_IDS = new Set(["services", "capabilities", "mainactivities", "activities"]);

export const isSelectedServicesSection = (section: SelectedProfileSection): boolean =>
  section.semanticRole === "services" || SERVICE_ROLE_IDS.has(normalizeToken(section.id));
const FEATURE_ROLE_IDS = new Set(["features", "productfeatures", "platformfeatures", "functionality"]);
const USE_CASE_ROLE_IDS = new Set(["usecases", "applications", "productapplications"]);
export type StructuredSectionContract = { kind: "service" | "feature" | "use-case"; min: number; max: number; titleMax: number; wordMax: number };
export const structuredSectionContract = (section: SelectedProfileSection): StructuredSectionContract | null => {
  const id = normalizeToken(section.id);
  if (isSelectedServicesSection(section)) return { kind: "service", min: 1, max: 12, titleMax: 28, wordMax: 16 };
  if (section.semanticRole === "features" || FEATURE_ROLE_IDS.has(id)) return { kind: "feature", min: 1, max: 12, titleMax: 40, wordMax: 20 };
  if (section.semanticRole === "use_cases" || USE_CASE_ROLE_IDS.has(id)) return { kind: "use-case", min: 1, max: 9, titleMax: 34, wordMax: 16 };
  return null;
};

export type GeneratedProfileValidationContext = {
  serviceSourceMaterial?: readonly string[];
  productSourceMaterial?: readonly string[];
  productTech?: boolean;
};

const normalizeEvidence = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
export const serviceItemTitleCapacityError = (title: string): string | null => {
  const trimmed = title.trim();
  if (!trimmed) return "Service item titles are required.";
  if (trimmed.length > 28 || trimmed.split(/\s+/).some((word) => word.length > 16)) return "Service item titles must be 28 characters or fewer, with no word longer than 16 characters.";
  return null;
};

const validateServicesSection = (
  section: GeneratedProfileSection,
  sectionIndex: number,
  sourceMaterial: readonly string[],
  approvedItems: readonly ApprovedProfileItem[],
): GeneratedSectionDiagnostic[] => {
  if (section.items.length === 0) return [{ code: "generated_services_items_required", sectionId: section.id, path: `sections.${sectionIndex}.items` }];
  if (section.items.length > 12) return [{ code: "generated_services_count_unsupported", sectionId: section.id, path: `sections.${sectionIndex}.items` }];
  const diagnostics: GeneratedSectionDiagnostic[] = [];
  const source = normalizeEvidence(sourceMaterial.filter((value) => typeof value === "string" && value.trim()).join("\n"));
  const seenIds = new Set<string>();
  section.items.forEach((item, itemIndex) => {
    const path = `sections.${sectionIndex}.items.${itemIndex}`;
    const approvedItem = approvedItems[itemIndex];
    const expectedId = approvedItem?.id ?? `${section.id}:service:${itemIndex + 1}`;
    if (!item.id?.trim() || !item.name.trim() || !item.description.trim() || !item.sourceEvidence?.trim()) {
      diagnostics.push({ code: "generated_service_item_invalid", sectionId: section.id, path });
    }
    if (item.id && seenIds.has(item.id)) diagnostics.push({ code: "generated_service_item_duplicate_id", sectionId: section.id, path: `${path}.id` });
    if (item.id) seenIds.add(item.id);
    if (item.id && item.id !== expectedId) diagnostics.push({ code: "generated_service_item_unstable_id", sectionId: section.id, path: `${path}.id` });
    if (serviceItemTitleCapacityError(item.name)) diagnostics.push({ code: "generated_service_item_title_capacity_unsupported", sectionId: section.id, path: `${path}.name` });
    if (approvedItem && item.name !== approvedItem.title) diagnostics.push({ code: "generated_service_item_invalid", sectionId: section.id, path: `${path}.name` });
    const evidence = normalizeEvidence(item.sourceEvidence ?? "");
    if (evidence && (!source || !source.includes(evidence) || !normalizeEvidence(item.description).includes(evidence))) diagnostics.push({ code: "generated_service_item_evidence_unsupported", sectionId: section.id, path: `${path}.sourceEvidence` });
  });
  return diagnostics;
};

const validateProductItems = (section: GeneratedProfileSection, sectionIndex: number, sourceMaterial: readonly string[], approvedItems: readonly ApprovedProfileItem[], contract: StructuredSectionContract): GeneratedSectionDiagnostic[] => {
  if (section.items.length < contract.min) return [{ code: "generated_product_items_required", sectionId: section.id, path: `sections.${sectionIndex}.items` }];
  if (section.items.length > contract.max) return [{ code: "generated_product_item_count_unsupported", sectionId: section.id, path: `sections.${sectionIndex}.items` }];
  const diagnostics: GeneratedSectionDiagnostic[] = []; const seen = new Set<string>();
  const source = normalizeEvidence(sourceMaterial.filter(Boolean).join("\n"));
  section.items.forEach((item, index) => {
    const path = `sections.${sectionIndex}.items.${index}`; const approved = approvedItems[index]; const expected = approved?.id ?? `${section.id}:${contract.kind}:${index + 1}`;
    if (!item.id?.trim() || !item.name.trim() || !item.description.trim() || !item.sourceEvidence?.trim() || (approved && item.name !== approved.title)) diagnostics.push({ code: "generated_product_item_invalid", sectionId: section.id, path });
    if (item.id && seen.has(item.id)) diagnostics.push({ code: "generated_product_item_duplicate_id", sectionId: section.id, path: `${path}.id` }); if (item.id) seen.add(item.id);
    if (item.id && item.id !== expected) diagnostics.push({ code: "generated_product_item_unstable_id", sectionId: section.id, path: `${path}.id` });
    if (item.name.trim().length > contract.titleMax || item.name.trim().split(/\s+/).some((word) => word.length > contract.wordMax)) diagnostics.push({ code: "generated_product_item_title_capacity_unsupported", sectionId: section.id, path: `${path}.name` });
    const evidence = normalizeEvidence(item.sourceEvidence ?? ""); if (evidence && (!source.includes(evidence) || !normalizeEvidence(item.description).includes(evidence))) diagnostics.push({ code: "generated_product_item_evidence_unsupported", sectionId: section.id, path: `${path}.sourceEvidence` });
  });
  return diagnostics;
};

const isGeneratedSection = (value: unknown): value is GeneratedProfileSection => {
  if (!value || typeof value !== "object") return false;
  const section = value as Record<string, unknown>;
  return typeof section.id === "string" && typeof section.title === "string" &&
    typeof section.description === "string" && typeof section.content === "string" &&
    Array.isArray(section.items) && section.items.every(isGeneratedItem);
};

export const validateGeneratedProfileSections = (
  selectedSections: readonly SelectedProfileSection[],
  returnedSections: unknown,
  context: GeneratedProfileValidationContext = {},
): GeneratedSectionsValidationResult => {
  if (!Array.isArray(returnedSections)) {
    return { valid: false, sections: null, diagnostics: [{ code: "generated_sections_invalid_shape", sectionId: null, path: "sections" }] };
  }

  const diagnostics: GeneratedSectionDiagnostic[] = [];
  const validSections: GeneratedProfileSection[] = [];
  returnedSections.forEach((value, index) => {
    if (!isGeneratedSection(value)) {
      diagnostics.push({ code: "generated_sections_invalid_shape", sectionId: null, path: `sections.${index}` });
    } else validSections.push(value);
  });
  if (diagnostics.length > 0) return { valid: false, sections: null, diagnostics };

  const selectedById = new Map(selectedSections.map((section) => [section.id, section]));
  const returnedById = new Map<string, GeneratedProfileSection>();
  validSections.forEach((section, index) => {
    if (returnedById.has(section.id)) {
      diagnostics.push({ code: "generated_section_duplicate_id", sectionId: section.id, path: `sections.${index}.id` });
      return;
    }
    returnedById.set(section.id, section);
    const selected = selectedById.get(section.id);
    if (!selected) diagnostics.push({ code: "generated_section_unknown_id", sectionId: section.id, path: `sections.${index}.id` });
    else if (section.title !== selected.displayTitle) diagnostics.push({ code: "generated_section_title_mismatch", sectionId: section.id, path: `sections.${index}.title` });
  });
  selectedSections.forEach((section, index) => {
    if (!returnedById.has(section.id)) diagnostics.push({ code: "generated_section_missing_id", sectionId: section.id, path: `selectedSections.${index}.id` });
  });
  selectedSections.forEach((selected) => {
    const returned = returnedById.get(selected.id);
    if (!returned || !isSelectedServicesSection(selected)) return;
    const approvedItems = selected.items ?? [];
    if (approvedItems.length > 0 && returned.items.length !== approvedItems.length) {
      diagnostics.push({ code: "generated_service_item_invalid", sectionId: selected.id, path: `sections.${validSections.indexOf(returned)}.items` });
    }
    diagnostics.push(...validateServicesSection(returned, validSections.indexOf(returned), [
      selected.description,
      ...approvedItems.flatMap((item) => [item.title, item.description]),
      ...(context.serviceSourceMaterial ?? []),
    ], approvedItems));
  });
  if (context.productTech) selectedSections.forEach((selected) => {
    const returned = returnedById.get(selected.id); if (!returned) return; const contract = structuredSectionContract(selected); const sectionIndex = validSections.indexOf(returned);
    if (!contract && ["about", "overview", "companyprofile", "ourstory"].includes(normalizeToken(selected.id))) {
      const result = productTechOverviewTemplate.prepare({ contentId: returned.id, title: returned.title, supportingLine: returned.description, body: returned.content });
      if (!result.compatible) diagnostics.push({ code: "generated_product_content_capacity_unsupported", sectionId: returned.id, path: `sections.${sectionIndex}` });
    } else if (contract?.kind === "feature" || contract?.kind === "use-case") {
      const limit = contract.kind === "feature" ? 4 : 3; let offset = 0; let sequence = 0;
      while (offset < returned.items.length) { const chunk = returned.items.slice(offset, offset + limit); const templates = contract.kind === "feature" ? (sequence ? productFeatureContinuationTemplates : productFeaturePrimaryTemplates) : (sequence ? productUseCaseContinuationTemplates : productUseCasePrimaryTemplates); const template = templates[chunk.length - 1]; const items = chunk.map((item, index) => ({ contentId: item.id!, index: String(offset + index + 1).padStart(2, "0"), title: item.name, description: item.description })); const candidate = contract.kind === "feature" ? { contentId: returned.id, heading: returned.title, supportingLine: returned.description, features: items } : { contentId: returned.id, heading: returned.title, supportingLine: returned.description, useCases: items }; const result = template.prepare(candidate as never); if (!result.compatible) diagnostics.push({ code: "generated_product_content_capacity_unsupported", sectionId: returned.id, path: `sections.${sectionIndex}` }); offset += limit; sequence += 1; }
    }
  });
  selectedSections.forEach((selected) => {
    const contract = structuredSectionContract(selected); const returned = returnedById.get(selected.id);
    if (!returned || !contract || contract.kind === "service") return;
    const approvedItems = selected.items ?? [];
    if (approvedItems.length && returned.items.length !== approvedItems.length) diagnostics.push({ code: "generated_product_item_invalid", sectionId: selected.id, path: `sections.${validSections.indexOf(returned)}.items` });
    diagnostics.push(...validateProductItems(returned, validSections.indexOf(returned), [selected.description, ...approvedItems.flatMap((item) => [item.title, item.description]), ...(context.productSourceMaterial ?? [])], approvedItems, contract));
  });
  if (diagnostics.length > 0) return { valid: false, sections: null, diagnostics };
  return { valid: true, sections: selectedSections.map((section) => returnedById.get(section.id)!), diagnostics: [] };
};

export const generatedSectionsErrorMessage = "The generated profile did not contain the complete approved section structure. Please generate it again.";

export const createStableCustomSectionId = (title: string, existingIds: readonly string[]): string => {
  const slug = title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
  const base = `custom-${slug}`;
  const existing = new Set(existingIds);
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
};

type StorageWriter = { setItem(key: string, value: string): void };

export const persistApprovedProfileStructure = (
  storage: StorageWriter,
  companyData: unknown,
  structure: { companyType: string; recommendedSections: readonly SelectedProfileSection[] },
  selectedSectionIds: readonly string[],
): SelectedProfileSection[] => {
  const selectedIds = new Set(selectedSectionIds);
  const selectedSections = structure.recommendedSections.filter((section) => selectedIds.has(section.id));
  storage.setItem("profileStructure", JSON.stringify({ companyData, analysis: structure, selectedSections }));
  return selectedSections;
};
import { productTechOverviewTemplate } from "./authored-templates/packs/product-tech-v1/overview";
import { productFeatureContinuationTemplates, productFeaturePrimaryTemplates } from "./authored-templates/packs/product-tech-v1/features";
import { productUseCaseContinuationTemplates, productUseCasePrimaryTemplates } from "./authored-templates/packs/product-tech-v1/use-cases";
