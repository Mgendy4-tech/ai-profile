export type StoredCompanyIdentity = { name?: string; logoUrl?: string; about?: string; companyType?: string; industry?: string; customerType?: string; servicesProducts?: string; activities?: string; experience?: string };
export type NewCompanyIsolationResult = { companyData: Record<string, unknown>; projects: unknown[]; clearKeys: readonly string[]; companyChanged: boolean };

const identity = (value: string | undefined) => (value ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export const isolateNewCompanyState = (
  previous: StoredCompanyIdentity | null,
  next: Record<string, unknown> & { name?: string; logoUrl?: string },
  projects: readonly unknown[],
  logoExplicitlySelected: boolean,
  explicitlyEditedFields: ReadonlySet<string> = new Set(),
): NewCompanyIsolationResult => {
  const companyChanged = Boolean(previous?.name && identity(previous.name) !== identity(next.name));
  const semanticFields = ["name", "about", "companyType", "industry", "customerType", "servicesProducts", "activities", "experience"] as const;
  const semanticChanged = Boolean(previous && semanticFields.some((field) => identity(previous[field]) !== identity(typeof next[field] === "string" ? next[field] : undefined)));
  if (!companyChanged) return { companyData: { ...next }, projects: [...projects], clearKeys: semanticChanged ? ["profileStructure", "generatedProfile", "authoredFamilyDecision", "exportDecision"] : [], companyChanged: false };
  return {
    companyData: {
      ...next,
      ...Object.fromEntries(["companyType", "industry", "customerType", "servicesProducts"].map((field) => [field, explicitlyEditedFields.has(field) ? next[field] ?? "" : ""])),
      logoUrl: logoExplicitlySelected ? next.logoUrl ?? "" : "",
    },
    projects: [],
    clearKeys: ["profileStructure", "generatedProfile", "authoredFamilyDecision", "exportDecision", "projectsData"],
    companyChanged: true,
  };
};
