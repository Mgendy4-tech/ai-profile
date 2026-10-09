import type { CompanyData } from "./company-data";
import { persistedImageState, type PersistedProject } from "./persisted-projects";

export type PersistedGeneratedProfileItem = { id?: string; name: string; description: string; sourceEvidence?: string; imageUrl?: string };
export type PersistedGeneratedProfileSection = { id: string; semanticRole?: string; title: string; description: string; content: string; items: PersistedGeneratedProfileItem[] };
export type PersistedGeneratedProfile = {
  companyName: string; logoUrl?: string; companyType: string; sections: PersistedGeneratedProfileSection[];
  about: string; expertise: string[]; experience: string;
  projects: { id?: string; name: string; description: string; imageUrl?: string }[]; reasons: string[];
  sourceFingerprint?: string;
};
type StorageReader = { getItem(key: string): string | null };
type StorageWriter = { setItem(key: string, value: string): void };
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((entry) => typeof entry === "string");
const isItem = (value: unknown): value is PersistedGeneratedProfileItem => {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.name === "string" && typeof item.description === "string" && (item.id === undefined || typeof item.id === "string") && (item.sourceEvidence === undefined || typeof item.sourceEvidence === "string") && (item.imageUrl === undefined || typeof item.imageUrl === "string");
};
const isSection = (value: unknown): value is PersistedGeneratedProfileSection => {
  if (!value || typeof value !== "object") return false;
  const section = value as Record<string, unknown>;
  return typeof section.id === "string" && typeof section.title === "string" && typeof section.description === "string" && typeof section.content === "string" && (section.semanticRole === undefined || typeof section.semanticRole === "string") && Array.isArray(section.items) && section.items.every(isItem);
};
const isProject = (value: unknown): value is PersistedGeneratedProfile["projects"][number] => {
  if (!value || typeof value !== "object") return false;
  const project = value as Record<string, unknown>;
  return typeof project.name === "string" && typeof project.description === "string" && (project.id === undefined || typeof project.id === "string") && (project.imageUrl === undefined || typeof project.imageUrl === "string");
};
export const parsePersistedGeneratedProfile = (value: unknown): PersistedGeneratedProfile | null => {
  if (!value || typeof value !== "object") return null;
  const profile = value as Record<string, unknown>;
  if (typeof profile.companyName !== "string" || typeof profile.companyType !== "string" || typeof profile.about !== "string" || typeof profile.experience !== "string" || (profile.logoUrl !== undefined && typeof profile.logoUrl !== "string") || (profile.sourceFingerprint !== undefined && typeof profile.sourceFingerprint !== "string") || !Array.isArray(profile.sections) || !profile.sections.every(isSection) || !Array.isArray(profile.projects) || !profile.projects.every(isProject) || !isStringArray(profile.expertise) || !isStringArray(profile.reasons)) return null;
  return profile as PersistedGeneratedProfile;
};
export const readPersistedGeneratedProfile = (storage: StorageReader): PersistedGeneratedProfile | null => {
  try { const raw = storage.getItem("generatedProfile"); return raw ? parsePersistedGeneratedProfile(JSON.parse(raw)) : null; } catch { return null; }
};
export const persistGeneratedProfile = (storage: StorageWriter, profile: PersistedGeneratedProfile) => storage.setItem("generatedProfile", JSON.stringify(profile));

export const createGeneratedProfileSourceFingerprint = (company: Pick<CompanyData, "name" | "about" | "companyType" | "industry" | "customerType" | "servicesProducts" | "activities" | "experience">, projects: readonly Pick<PersistedProject, "id" | "name" | "description" | "imageUrl">[]): string => JSON.stringify({
  company: [company.name, company.about, company.companyType, company.industry, company.customerType, company.servicesProducts, company.activities, company.experience].map((value) => value.trim()),
  projects: projects.map((project) => [project.id, project.name.trim(), project.description.trim(), persistedImageState(project.imageUrl)]),
});

export const isPersistedGeneratedProfileCurrent = (profile: PersistedGeneratedProfile, company: CompanyData, projects: readonly PersistedProject[]): boolean => {
  if (profile.sourceFingerprint) return profile.sourceFingerprint === createGeneratedProfileSourceFingerprint(company, projects);
  if (profile.companyName.trim().toLowerCase() !== company.name.trim().toLowerCase()) return false;
  if ((profile.logoUrl ?? "") !== company.logoUrl) return false;
  if (projects.length === 0) return true;
  return profile.projects.length === projects.length && profile.projects.every((project, index) => project.name === projects[index]?.name && project.description === projects[index]?.description && persistedImageState(project.imageUrl) === persistedImageState(projects[index]?.imageUrl));
};

export const reconcileGeneratedProfileToSource = (profile: PersistedGeneratedProfile, company: CompanyData, projects: readonly PersistedProject[]): PersistedGeneratedProfile => {
  const findProject = (candidate: { id?: string; name: string }) => projects.find((project) => (candidate.id && project.id === candidate.id) || project.name === candidate.name);
  const reconciledProjects = profile.projects.map((project) => {
    const source = findProject(project);
    return source ? { ...project, id: source.id, imageUrl: source.imageUrl } : { ...project, imageUrl: undefined };
  });
  const projectSection = (section: PersistedGeneratedProfileSection) => section.id === "projects" || section.semanticRole === "projects";
  return {
    ...profile,
    logoUrl: company.logoUrl,
    projects: reconciledProjects,
    sections: profile.sections.map((section) => projectSection(section) ? {
      ...section,
      items: section.items.map((item) => {
        const source = findProject(item);
        return source ? { ...item, id: source.id, imageUrl: source.imageUrl } : { ...item, imageUrl: undefined };
      }),
    } : section),
  };
};
/** Counts only explicit generated project structures; narrative keyword scanning is forbidden. */
export const generatedProjectEvidenceCount = (profile: PersistedGeneratedProfile): number => {
  const section = profile.sections.find((candidate) => candidate.id === "projects" || candidate.semanticRole === "projects");
  return section?.items.length ?? 0;
};
