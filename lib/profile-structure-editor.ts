import {
  isSelectedServicesSection,
  serviceItemTitleCapacityError,
  structuredSectionContract,
  type ApprovedProfileItem,
  type SelectedProfileSection,
} from "./generated-profile-boundary";
import { validateAnalyzedProfileStructure } from "./profile-structure-boundary";

export type EditableProfileStructure = {
  companyType: string;
  recommendedSections: readonly SelectedProfileSection[];
};

export type StructureEditResult =
  | { valid: true; structure: EditableProfileStructure; error: null }
  | { valid: false; structure: EditableProfileStructure; error: string };

const slug = (value: string) => value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "service";

export const createStableServiceItemId = (sectionId: string, title: string, existingIds: readonly string[]): string => {
  const base = `${sectionId}:service:${slug(title)}`;
  const existing = new Set(existingIds);
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
};
const createStableStructuredItemId = (sectionId: string, kind: "feature" | "use-case", title: string, existingIds: readonly string[]): string => {
  const base = `${sectionId}:${kind}:${slug(title)}`; const existing = new Set(existingIds); if (!existing.has(base)) return base; let suffix = 2; while (existing.has(`${base}-${suffix}`)) suffix += 1; return `${base}-${suffix}`;
};

export const validateApprovedStructure = (structure: EditableProfileStructure): string | null => {
  const sectionIds = new Set<string>();
  const itemIds = new Set<string>();
  for (const section of structure.recommendedSections) {
    if (sectionIds.has(section.id)) return `Section ID ${section.id} is duplicated.`;
    sectionIds.add(section.id);
    const contract = structuredSectionContract(section); if (!contract) continue;
    const items = section.items ?? [];
    if (items.length > contract.max) return `${contract.kind === "feature" ? "Product features" : contract.kind === "use-case" ? "Product use cases" : "Corporate services"} support at most ${contract.max} items.`;
    for (const item of items) {
      if (itemIds.has(item.id)) return `Structured item ID ${item.id} is duplicated.`;
      itemIds.add(item.id);
      const capacityError = contract.kind === "service" ? serviceItemTitleCapacityError(item.title) : item.title.trim().length > contract.titleMax || item.title.trim().split(/\s+/).some((word) => word.length > contract.wordMax) ? `Item titles must be ${contract.titleMax} characters or fewer, with no word longer than ${contract.wordMax} characters.` : null;
      if (capacityError) return capacityError;
      if (!item.description.trim()) return "Service item descriptions are required.";
    }
  }
  const boundary = validateAnalyzedProfileStructure(structure);
  return boundary.valid ? null : "The edited structure exceeds or conflicts with the selected authored family contract.";
};

const updateSection = (structure: EditableProfileStructure, sectionId: string, update: (section: SelectedProfileSection) => SelectedProfileSection): EditableProfileStructure => ({
  ...structure,
  recommendedSections: structure.recommendedSections.map((section) => section.id === sectionId ? update(section) : section),
});

export const editApprovedSection = (structure: EditableProfileStructure, sectionId: string, values: { displayTitle: string; description: string }): StructureEditResult => {
  if (!values.displayTitle.trim() || !values.description.trim()) return { valid: false, structure, error: "Section titles and descriptions are required." };
  const next = updateSection(structure, sectionId, (section) => ({ ...section, displayTitle: values.displayTitle.trim(), description: values.description.trim() }));
  const error = validateApprovedStructure(next);
  return error ? { valid: false, structure, error } : { valid: true, structure: next, error: null };
};

export const addApprovedServiceItem = (structure: EditableProfileStructure, sectionId: string, values: { title: string; description: string }): StructureEditResult => {
  const title = values.title.trim(); const description = values.description.trim();
  const capacityError = serviceItemTitleCapacityError(title);
  if (capacityError || !description) return { valid: false, structure, error: capacityError ?? "Service item descriptions are required." };
  const section = structure.recommendedSections.find((candidate) => candidate.id === sectionId);
  if (!section || !isSelectedServicesSection(section)) return { valid: false, structure, error: "This section does not support Corporate service items." };
  const items = section.items ?? [];
  if (items.length >= 12) return { valid: false, structure, error: "Corporate services support at most 12 items." };
  const item: ApprovedProfileItem = { id: createStableServiceItemId(sectionId, title, items.map((entry) => entry.id)), title, description };
  const next = updateSection(structure, sectionId, (current) => ({ ...current, items: [...(current.items ?? []), item] }));
  return { valid: true, structure: next, error: null };
};

export const addApprovedStructuredItem = (structure: EditableProfileStructure, sectionId: string, values: { title: string; description: string }): StructureEditResult => {
  const section = structure.recommendedSections.find((candidate) => candidate.id === sectionId); const contract = section && structuredSectionContract(section);
  if (!section || !contract) return { valid: false, structure, error: "This section does not support structured items." };
  if (contract.kind === "service") return addApprovedServiceItem(structure, sectionId, values);
  const title = values.title.trim(); const description = values.description.trim();
  if (!title || !description || title.length > contract.titleMax || title.split(/\s+/).some((word) => word.length > contract.wordMax)) return { valid: false, structure, error: `Item titles must be ${contract.titleMax} characters or fewer, with no word longer than ${contract.wordMax} characters; descriptions are required.` };
  const items = section.items ?? []; if (items.length >= contract.max) return { valid: false, structure, error: `${contract.kind === "feature" ? "Product features" : "Product use cases"} support at most ${contract.max} items.` };
  const item = { id: createStableStructuredItemId(sectionId, contract.kind, title, items.map((entry) => entry.id)), title, description };
  return { valid: true, structure: updateSection(structure, sectionId, (current) => ({ ...current, items: [...(current.items ?? []), item] })), error: null };
};

export const editApprovedServiceItem = (structure: EditableProfileStructure, sectionId: string, itemId: string, values: { title: string; description: string }): StructureEditResult => {
  const title = values.title.trim(); const description = values.description.trim();
  const capacityError = serviceItemTitleCapacityError(title);
  if (capacityError || !description) return { valid: false, structure, error: capacityError ?? "Service item descriptions are required." };
  const next = updateSection(structure, sectionId, (section) => ({ ...section, items: (section.items ?? []).map((item) => item.id === itemId ? { ...item, title, description } : item) }));
  const error = validateApprovedStructure(next);
  return error ? { valid: false, structure, error } : { valid: true, structure: next, error: null };
};
export const editApprovedStructuredItem = (structure: EditableProfileStructure, sectionId: string, itemId: string, values: { title: string; description: string }): StructureEditResult => {
  const section = structure.recommendedSections.find((candidate) => candidate.id === sectionId); const contract = section && structuredSectionContract(section);
  if (!section || !contract) return { valid: false, structure, error: "This section does not support structured items." };
  if (contract.kind === "service") return editApprovedServiceItem(structure, sectionId, itemId, values);
  const title = values.title.trim(); const description = values.description.trim();
  if (!title || !description || title.length > contract.titleMax || title.split(/\s+/).some((word) => word.length > contract.wordMax)) return { valid: false, structure, error: `Item titles must be ${contract.titleMax} characters or fewer, with no word longer than ${contract.wordMax} characters; descriptions are required.` };
  const next = updateSection(structure, sectionId, (current) => ({ ...current, items: (current.items ?? []).map((item) => item.id === itemId ? { ...item, title, description } : item) })); const error = validateApprovedStructure(next);
  return error ? { valid: false, structure, error } : { valid: true, structure: next, error: null };
};

export const deleteApprovedServiceItem = (structure: EditableProfileStructure, sectionId: string, itemId: string): EditableProfileStructure =>
  updateSection(structure, sectionId, (section) => ({ ...section, items: (section.items ?? []).filter((item) => item.id !== itemId) }));

export const moveApprovedServiceItem = (structure: EditableProfileStructure, sectionId: string, itemId: string, direction: -1 | 1): EditableProfileStructure => updateSection(structure, sectionId, (section) => {
  const items = [...(section.items ?? [])];
  const from = items.findIndex((item) => item.id === itemId); const to = from + direction;
  if (from < 0 || to < 0 || to >= items.length) return section;
  [items[from], items[to]] = [items[to], items[from]];
  return { ...section, items };
});

export const moveApprovedSection = (structure: EditableProfileStructure, sectionId: string, direction: -1 | 1): EditableProfileStructure => {
  const sections = [...structure.recommendedSections];
  const from = sections.findIndex((section) => section.id === sectionId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= sections.length) return structure;
  [sections[from], sections[to]] = [sections[to], sections[from]];
  return { ...structure, recommendedSections: sections };
};

export const isCustomSection = (section: SelectedProfileSection): boolean => section.id.startsWith("custom-");

export const deleteApprovedCustomSection = (structure: EditableProfileStructure, sectionId: string): StructureEditResult => {
  const section = structure.recommendedSections.find((candidate) => candidate.id === sectionId);
  if (!section || !isCustomSection(section)) return { valid: false, structure, error: "Only sections added by you can be deleted." };
  const next = { ...structure, recommendedSections: structure.recommendedSections.filter((candidate) => candidate.id !== sectionId) };
  const error = validateApprovedStructure(next);
  return error ? { valid: false, structure, error } : { valid: true, structure: next, error: null };
};
