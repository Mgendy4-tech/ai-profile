import type { CompanyData } from "./company-data";
import { isPersistedGeneratedProfileCurrent, type PersistedGeneratedProfile } from "./generated-profile-storage";
import { persistedImageState, type PersistedProject } from "./persisted-projects";
import type { FamilyChoice } from "./authored-templates/family-selection";

export type OnboardingStatus = "ready" | "needs-attention" | "not-generated";
export type OnboardingStep = { id: "company" | "projects" | "generate" | "export"; label: string; status: OnboardingStatus; detail: string };
export type OnboardingProject = { id?: string; name: string; description: string; imageUrl?: string };

export type OnboardingProgressInput = {
  company: CompanyData | null;
  projects: readonly OnboardingProject[];
  profile?: PersistedGeneratedProfile | null;
  familyChoices?: readonly FamilyChoice[];
  selectedFamily?: string | null;
};

export const isCompanyReady = (company: CompanyData | null): boolean => Boolean(company?.name.trim() && company.about.trim());

export const isProjectPathReady = (company: CompanyData | null, projects: readonly OnboardingProject[]): boolean => {
  if (!projects.length) return isCompanyReady(company);
  return projects.every((project) => persistedImageState(project.imageUrl) === "valid");
};

export const deriveOnboardingProgress = ({ company, projects, profile, familyChoices = [], selectedFamily = null }: OnboardingProgressInput): OnboardingStep[] => {
  const companyReady = isCompanyReady(company);
  const projectReady = isProjectPathReady(company, projects);
  const normalizedProjects: PersistedProject[] = projects.map((project, index) => ({
    id: project.id ?? `onboarding:${index}`,
    name: project.name,
    description: project.description,
    imageUrl: project.imageUrl ?? "",
  }));
  const profileFresh = Boolean(profile && company && isPersistedGeneratedProfileCurrent(profile, company, normalizedProjects));
  const selectedChoice = (selectedFamily ? familyChoices.find((choice) => choice.id === selectedFamily) : undefined) ?? familyChoices.find((choice) => choice.recommended);
  const exportReady = Boolean(profileFresh && selectedChoice?.eligible && projectReady);
  const invalidProject = projects.some((project) => persistedImageState(project.imageUrl) !== "valid");

  return [
    { id: "company", label: "Company", status: companyReady ? "ready" : "needs-attention", detail: companyReady ? "Company information saved." : "Add your company name and a short description." },
    { id: "projects", label: "Projects", status: projectReady ? "ready" : "needs-attention", detail: invalidProject ? "Replace or add a valid project image to unlock Visual / Portfolio." : projects.length ? "Project information and imagery are ready." : "No project is required to continue with a service-led profile." },
    { id: "generate", label: "Generate", status: profileFresh ? "ready" : companyReady ? "needs-attention" : "not-generated", detail: profileFresh ? "Fresh profile generated." : "Generate your profile after saving company information." },
    { id: "export", label: "Export", status: exportReady ? "ready" : profileFresh ? "needs-attention" : "not-generated", detail: exportReady ? `${selectedChoice?.label ?? "Selected family"} is ready to export.` : "Generate a fresh profile and choose an available family before exporting." },
  ];
};
