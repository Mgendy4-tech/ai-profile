type Family = "visual-portfolio" | "corporate-services" | "product-tech";
type CompanyIdentity = { name: string; companyType?: string; industry?: string; about?: string; servicesProducts?: string; activities?: string };
type PresentationItem = { name: string; description: string; sourceEvidence?: string };

const normalized = (value: string) => value.trim().replace(/\s+/g, " ");
const sourceCorpus = (company: CompanyIdentity) => [company.about, company.companyType, company.industry, company.servicesProducts, company.activities].filter(Boolean).join("\n").toLocaleLowerCase();
const generatedFiller = /\b(?:source-backed|supplied information|supplied (?:advisory|product|company|project) information|grounded in supplied|based on supplied)\b/i;

export const customerFacingSectionLine = (family: Family, company: CompanyIdentity, items: readonly PresentationItem[] = []) => {
  if (items.length) {
    if (family === "visual-portfolio") return "A coordinated view of the studio's design practice.";
    if (family === "corporate-services") return "A structured view of the firm's advisory practice.";
    return "A structured view of the platform's capabilities.";
  }
  return [normalized(company.companyType ?? ""), normalized(company.industry ?? "")].filter((value, index, values) => value && values.indexOf(value) === index).join(" · ") || `${company.name} profile`;
};

export const customerFacingItemDescription = (family: Family, company: CompanyIdentity, item: PresentationItem) => {
  const description = normalized(item.description);
  if (!generatedFiller.test(description) || sourceCorpus(company).includes(description.toLocaleLowerCase())) return description;
  const owner = `${company.name}${/s$/i.test(company.name) ? "'" : "'s"}`;
  if (family === "visual-portfolio") return `Part of ${owner} design capabilities.`;
  if (family === "corporate-services") return `Part of ${owner} advisory services.`;
  return `Part of ${owner} platform capabilities.`;
};

export const containsInternalPresentationCopy = (value: string) => /\b(?:present|introduce|explain|showcase)\b[^.]{0,100}\b(?:supplied|renderer|section|profile|capabilit|service|feature|use case)/i.test(value);
export const containsGeneratedFillerCopy = (value: string) => generatedFiller.test(value);
