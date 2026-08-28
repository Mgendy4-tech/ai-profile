import type { PersistedCompanyInput } from "./enrichment";
import type { NarrativeFact } from "./packs/editorial-interiors-v1/content";

const clean = (value: string | undefined) => value?.trim().replace(/\s+/g, " ") ?? "";

const experienceValue = (value: string) => {
  if (/^\d+(?:\.\d+)?$/.test(value)) return `${value} YEARS`;
  return value.toUpperCase();
};

/** Fixed-priority, source-backed facts for the authored Visual sparse About variants. */
export const extractVisualNarrativeFacts = (company: PersistedCompanyInput): readonly NarrativeFact[] => {
  const experience = clean(company.experience);
  const industry = clean(company.industry);
  const customerType = clean(company.customerType);
  const companyType = clean(company.companyType);
  const servicesProducts = clean(company.servicesProducts);
  const candidates: NarrativeFact[] = [
    ...(experience ? [{ value: experienceValue(experience), label: "EXPERIENCE" }] : []),
    ...(industry ? [{ value: industry.toUpperCase(), label: "INDUSTRY" }] : companyType ? [{ value: companyType.toUpperCase(), label: "COMPANY TYPE" }] : []),
    ...(customerType ? [{ value: customerType.toUpperCase(), label: "CLIENT FOCUS" }] : servicesProducts ? [{ value: servicesProducts.toUpperCase(), label: "SERVICE FOCUS" }] : []),
  ];
  return candidates.slice(0, 3);
};
