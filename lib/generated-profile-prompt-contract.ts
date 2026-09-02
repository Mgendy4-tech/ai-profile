import { experienceDurationLabel } from "./company-data";

type PromptCompany = {
  companyType?: string;
  industry?: string;
  customerType?: string;
  servicesProducts?: string;
  activities?: string;
  experience?: string;
};

type PromptSection = { id: string; displayTitle: string };

export const approvedSectionManifest = (sections: readonly PromptSection[]) => sections
  .map((section, index) => `${index + 1}. id=${JSON.stringify(section.id)} title=${JSON.stringify(section.displayTitle)}`)
  .join("\n");

export const semanticCoverageContract = (company: PromptCompany) => {
  const supplied = [
    ["Company Type", company.companyType],
    ["Industry", company.industry],
    ["Customer / Client Type", company.customerType],
    ["Services / Products", company.servicesProducts],
    ["Main Activities", company.activities],
    ["Years of Experience", company.experience],
  ].filter((entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1].trim()));
  const experience = company.experience?.trim() ?? "";
  const experienceInstruction = /^\d+(?:\.\d+)?$/.test(experience)
    ? `- Include the exact phrase ${JSON.stringify(`${experienceDurationLabel(experience)} of experience`)} naturally in one approved narrative section.`
    : experience ? `- Include the supplied experience information ${JSON.stringify(experience)} naturally in one approved narrative section.` : "";
  return `
SEMANTIC SOURCE COVERAGE CONTRACT:
- Treat every non-empty supplied field below as source content. Incorporate each meaningful fact naturally into the most appropriate approved section; do not create a separate section merely for a field.
${supplied.map(([label, value]) => `- ${label}: ${JSON.stringify(value)}`).join("\n")}
${experienceInstruction}
`;
};
