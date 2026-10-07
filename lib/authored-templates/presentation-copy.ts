export type CustomerFacingFamily = "visual-portfolio" | "corporate-services" | "product-tech";
export type CompanyIdentity = { name: string; companyType?: string; industry?: string; customerType?: string; about?: string; servicesProducts?: string; activities?: string; experience?: string };
type PresentationItem = { name: string; description: string; sourceEvidence?: string; imageUrl?: string };
export type CustomerFacingSection = { id?: string; title: string; description: string; content: string; items: readonly PresentationItem[] };

const normalized = (value: string) => value.trim().replace(/\s+/g, " ");
const sourceCorpus = (company: CompanyIdentity) => [company.about, company.companyType, company.industry, company.customerType, company.servicesProducts, company.activities, company.experience].filter(Boolean).join("\n").toLocaleLowerCase();
const generatedFiller = /\b(?:source-backed|supplied information|supplied (?:advisory|product|company|project) information|grounded in supplied|based on supplied)\b/i;
const unique = (values: readonly string[]) => values.map(normalized).filter((value, index, all) => value && all.indexOf(value) === index);
const companyDescriptor = (company: CompanyIdentity, fallback: string) => unique([company.companyType ?? "", company.industry ?? ""]).join(" · ") || fallback;
const possessive = (name: string) => `${name}${/s$/i.test(name) ? "'" : "'s"}`;
const audience = (company: CompanyIdentity) => company.customerType ? ` for ${normalized(company.customerType)}` : "";

const isLiteralSourceText = (value: string, company: CompanyIdentity) => sourceCorpus(company).includes(value.toLocaleLowerCase());
const needsCustomerFacingRewrite = (value: string, company: CompanyIdentity) => {
  const text = normalized(value);
  return Boolean(text) && !isLiteralSourceText(text, company) && (generatedFiller.test(text) || containsInternalPresentationCopy(text));
};

const familySupportingLine = (family: CustomerFacingFamily, company: CompanyIdentity, _items: readonly PresentationItem[]) => {
  if (family === "visual-portfolio") return `${possessive(company.name)} ${companyDescriptor(company, "design")} practice${audience(company)}.`;
  if (family === "corporate-services") return `${possessive(company.name)} practical advisory work${audience(company)}.`;
  return `${possessive(company.name)} product capabilities${audience(company)}.`;
};

export const customerFacingSectionLine = (family: CustomerFacingFamily, company: CompanyIdentity, items: readonly PresentationItem[] = []) => familySupportingLine(family, company, items);

export const customerFacingItemDescription = (family: CustomerFacingFamily, company: CompanyIdentity, item: PresentationItem) => {
  const description = normalized(item.description);
  if (!needsCustomerFacingRewrite(description, company)) return description;
  if (family === "visual-portfolio") return `Design capability within ${possessive(company.name)} practice.`;
  if (family === "corporate-services") return `Advisory capability within ${possessive(company.name)} offering.`;
  return `Platform capability within ${possessive(company.name)} product system.`;
};

export const containsInternalPresentationCopy = (value: string) => /\b(?:present|introduce|explain|showcase)\b[^.]{0,100}\b(?:supplied|renderer|section|profile|capabilit|service|feature|use case)/i.test(value);
export const containsGeneratedFillerCopy = (value: string) => generatedFiller.test(value);

export const customerFacingSectionCopy = (family: CustomerFacingFamily, company: CompanyIdentity, section: CustomerFacingSection) => {
  const items = section.items.map((item) => ({ ...item, description: customerFacingItemDescription(family, company, item) }));
  const fallback = customerFacingSectionLine(family, company, items);
  return {
    ...section,
    description: needsCustomerFacingRewrite(section.description, company) ? fallback : normalized(section.description),
    content: needsCustomerFacingRewrite(section.content, company) ? fallback : normalized(section.content),
    items,
  };
};

export const customerFacingSectionBody = (family: CustomerFacingFamily, company: CompanyIdentity, section: Pick<CustomerFacingSection, "description" | "content" | "items">) => customerFacingSectionCopy(family, company, { title: "", ...section }).content;
