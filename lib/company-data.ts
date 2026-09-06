export type CompanyData = {
  name: string;
  logoUrl: string;
  about: string;
  companyType: string;
  industry: string;
  customerType: string;
  servicesProducts: string;
  activities: string;
  experience: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  socialUrl?: string;
  brandColor?: string;
};

export const emptyCompanyData: CompanyData = {
  name: "",
  logoUrl: "",
  about: "",
  companyType: "",
  industry: "",
  customerType: "",
  servicesProducts: "",
  activities: "",
  experience: "",
  website: "", email: "", phone: "", address: "", socialUrl: "", brandColor: "",
};

const stringValue = (value: unknown) => typeof value === "string" ? value.trim() : "";
const hexColor = /^#[0-9a-f]{6}$/i;
export const normalizeBrandColor = (value: unknown): string => {
  const color = stringValue(value).toUpperCase();
  return hexColor.test(color) ? color : "";
};
export const validateCompanyContacts = (company: Pick<CompanyData, "website" | "email" | "phone" | "socialUrl">) => {
  const issues: Partial<Record<keyof typeof company, string>> = {};
  if (company.website && !/^https?:\/\//i.test(company.website)) issues.website = "Use a full website URL starting with https://.";
  if (company.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(company.email)) issues.email = "Enter a valid email address.";
  if (company.socialUrl && !/^https?:\/\//i.test(company.socialUrl)) issues.socialUrl = "Use a full profile URL starting with https://.";
  return issues;
};

/** Loads both the current schema and older saved objects without losing their logo. */
export const normalizeCompanyData = (value: unknown): CompanyData => {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    name: stringValue(source.name),
    logoUrl: stringValue(source.logoUrl),
    about: stringValue(source.about),
    companyType: stringValue(source.companyType),
    industry: stringValue(source.industry),
    customerType: stringValue(source.customerType),
    servicesProducts: stringValue(source.servicesProducts),
    activities: stringValue(source.activities),
    experience: stringValue(source.experience),
    website: stringValue(source.website), email: stringValue(source.email), phone: stringValue(source.phone),
    address: stringValue(source.address), socialUrl: stringValue(source.socialUrl), brandColor: normalizeBrandColor(source.brandColor),
  };
};

export const companySemanticText = (company: CompanyData) => ({
  name: company.name,
  about: company.about,
  companyType: company.companyType,
  industry: company.industry,
  customerType: company.customerType,
  servicesProducts: company.servicesProducts,
  activities: company.activities,
  experience: company.experience,
});

export const companySourceMaterial = (company: CompanyData): string[] => [
  company.about,
  company.companyType,
  company.industry,
  company.customerType,
  company.servicesProducts,
  company.activities,
  company.experience,
].filter((value) => Boolean(value.trim()));

export const experienceDurationLabel = (value: string): string => {
  const normalized = value.trim();
  return normalized === "1" ? "1 year" : `${normalized} years`;
};

export const experienceValidationMessage = (value: string): string | null => {
  const normalized = value.trim();
  if (!normalized) return null;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && numeric >= 0
    ? null
    : "Years of Experience must be 0 or greater.";
};
