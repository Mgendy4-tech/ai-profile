export type StoredCompanyIdentity = { name?: string; logoUrl?: string };
export type NewCompanyIsolationResult = { companyData: Record<string, unknown>; projects: unknown[]; clearKeys: readonly string[]; companyChanged: boolean };

const identity = (value: string | undefined) => (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export const isolateNewCompanyState = (
  previous: StoredCompanyIdentity | null,
  next: Record<string, unknown> & { name?: string; logoUrl?: string },
  projects: readonly unknown[],
  logoExplicitlySelected: boolean,
): NewCompanyIsolationResult => {
  const companyChanged = Boolean(previous?.name && identity(previous.name) !== identity(next.name));
  if (!companyChanged) return { companyData: { ...next }, projects: [...projects], clearKeys: [], companyChanged: false };
  return {
    companyData: { ...next, logoUrl: logoExplicitlySelected ? next.logoUrl ?? "" : "" },
    projects: [],
    clearKeys: ["profileStructure", "generatedProfile", "projectsData"],
    companyChanged: true,
  };
};
