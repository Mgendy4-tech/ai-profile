export type CustomerFacingFamily = "visual-portfolio" | "corporate-services" | "product-tech";
export type CompanyIdentity = { name: string; companyType?: string; industry?: string; customerType?: string; about?: string; servicesProducts?: string; activities?: string; experience?: string };
type PresentationItem = { name: string; description: string; sourceEvidence?: string; imageUrl?: string };
export type CustomerFacingSection = { id?: string; title: string; description: string; content: string; items: readonly PresentationItem[] };

const normalized = (value: string) => value.trim().replace(/\s+/g, " ");
const sourceCorpus = (company: CompanyIdentity) => [company.about, company.companyType, company.industry, company.customerType, company.servicesProducts, company.activities, company.experience].filter(Boolean).join("\n").toLocaleLowerCase();
const generatedFiller = /\b(?:source-backed|supplied information|supplied (?:advisory|product|company|project|residential|material-led) information|(?:the )?supplied (?:completed )?(?:company|project|project record|residential|material-led|design approach)|grounded in (?:the )?supplied|based on (?:the )?supplied)\b/i;
const plannerInstruction = /^\s*(?:describe|present|introduce|explain|showcase)\b[^.]{0,180}\b(?:supplied|provided|grounded|based on)\b/i;
const unique = (values: readonly string[]) => values.map(normalized).filter((value, index, all) => value && all.indexOf(value) === index);
const companyDescriptor = (company: CompanyIdentity, fallback: string) => unique([company.companyType ?? "", company.industry ?? ""]).join(" · ") || fallback;
const possessive = (name: string) => `${name}${/s$/i.test(name) ? "'" : "'s"}`;
const audience = (company: CompanyIdentity) => company.customerType ? ` for ${normalized(company.customerType)}` : "";
const compactFacts = (value: string, limit = 2) => unique(value.split(/,|;|\band\b/i)).slice(0, limit).join(" and ");
const capabilityFacts = (company: CompanyIdentity) => compactFacts(company.servicesProducts || company.activities || company.industry || company.companyType || "design services");
const approachFacts = (company: CompanyIdentity) => {
  const about = normalized(company.about ?? "");
  const match = about.match(/\b(?:around|with a focus on|focused on|using|through)\s+(.+?)(?:\.|$)/i);
  return match?.[1] || compactFacts(company.activities || company.servicesProducts || company.industry || "materials and function");
};
const projectFacts = (item: PresentationItem) => normalized(item.description).replace(/^an?\s+/i, "").replace(/\.$/, "") || "the available design details";
const sectionLabel = (title: string) => normalized(title).replace(/^(?:our|the)\s+/i, "").toLocaleLowerCase() || "practice";
const sectionKind = (title: string) => {
  const value = title.toLocaleLowerCase();
  if (/project|portfolio|case study/.test(value)) return "projects";
  if (/approach|method|process/.test(value)) return "approach";
  if (/expertise|focus/.test(value)) return "expertise";
  if (/capabilit|service|activit|feature/.test(value)) return "capabilities";
  if (/about|overview|story/.test(value)) return "about";
  return "general";
};
const customerFacingPlannerLine = (company: CompanyIdentity, title: string, items: readonly PresentationItem[] = []) => {
  const kind = sectionKind(title);
  if (kind === "about" && company.about && !generatedFiller.test(company.about)) return normalized(company.about);
  if (kind === "capabilities") return `${possessive(company.name)} brings together ${capabilityFacts(company)}.`;
  if (kind === "expertise") return `${possessive(company.name)} ${sectionLabel(title)} centers on ${normalized(company.industry || company.customerType || company.companyType || "interior design")}.`;
  if (kind === "approach") return `${possessive(company.name)} design approach balances ${approachFacts(company)}.`;
  if (kind === "projects" && items[0]) return `${items[0].name} is a completed project featuring ${projectFacts(items[0])}.`;
  return `${possessive(company.name)} ${sectionLabel(title)} reflects ${capabilityFacts(company)}.`;
};

const isLiteralSourceText = (value: string, company: CompanyIdentity) => sourceCorpus(company).includes(value.toLocaleLowerCase());
const needsCustomerFacingRewrite = (value: string, company: CompanyIdentity) => {
  const text = normalized(value);
  return Boolean(text) && !isLiteralSourceText(text, company) && (generatedFiller.test(text) || plannerInstruction.test(text) || containsInternalPresentationCopy(text));
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
export const customerFacingSectionDescription = (company: CompanyIdentity, title: string, description: string, items: readonly PresentationItem[] = []) => {
  const text = normalized(description);
  return needsCustomerFacingRewrite(text, company) ? customerFacingPlannerLine(company, title, items) : text;
};

export const customerFacingSectionCopy = (family: CustomerFacingFamily, company: CompanyIdentity, section: CustomerFacingSection) => {
  const items = section.items.map((item) => ({ ...item, description: customerFacingItemDescription(family, company, item) }));
  const fallback = customerFacingSectionLine(family, company, items);
  return {
    ...section,
    description: customerFacingSectionDescription(company, section.title, section.description, items),
    content: customerFacingSectionDescription(company, section.title, section.content, items),
    items,
  };
};

export const customerFacingSectionBody = (family: CustomerFacingFamily, company: CompanyIdentity, section: Pick<CustomerFacingSection, "title" | "description" | "content" | "items">) => customerFacingSectionCopy(family, company, section).content;
