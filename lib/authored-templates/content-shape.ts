import type {
  ContentShape,
  DeterministicContentFacts,
  NormalizedContentUnit,
  SemanticContentDescriptor,
} from "./library-types";

export type AuthoredNormalizationInput = {
  company: { id?: string };
  sections: readonly (
    | { id: string; role: "narrative"; content: string; coverage?: "required" | "optional" }
    | { id: string; role: "services"; items: readonly { id?: string }[]; coverage?: "required" | "optional" }
    | { id: string; role: "features" | "use_cases"; items: readonly { id?: string }[]; coverage?: "required" | "optional" }
  )[];
  projects: readonly { id: string; hasAuthenticImage: boolean; coverage?: "required" | "optional" }[];
};

export const normalizeAuthoredContentUnits = (
  input: AuthoredNormalizationInput,
): readonly NormalizedContentUnit[] => [
  {
    id: input.company.id ?? "company",
    kind: "company_identity",
    sourcePath: "company",
    coverage: "required",
  },
  ...input.sections.flatMap((section, sectionIndex): NormalizedContentUnit[] => {
    if (section.role === "narrative") {
      return [{
        id: section.id,
        kind: "narrative_section",
        sourcePath: `sections.${sectionIndex}`,
        coverage: section.coverage ?? "required",
        characterCount: section.content.length,
      }];
    }
    return section.items.map((item, itemIndex) => ({
      id: item.id ?? `${section.id}:item:${itemIndex}`,
      kind: section.role === "services" ? "service_capability" as const : section.role === "features" ? "product_feature" as const : "use_case" as const,
      sourcePath: `sections.${sectionIndex}.items.${itemIndex}`,
      coverage: section.coverage ?? "required",
    }));
  }),
  ...input.projects.map((project, projectIndex) => ({
    id: project.id,
    kind: "project" as const,
    sourcePath: `projects.${projectIndex}`,
    coverage: project.coverage ?? "required",
    hasAuthenticImage: project.hasAuthenticImage,
  })),
];

export const deriveDeterministicContentFacts = (
  units: readonly NormalizedContentUnit[],
  productTechSignal = false,
): DeterministicContentFacts => {
  const narrative = units.filter((unit) => unit.kind === "narrative_section");
  const projects = units.filter((unit) => unit.kind === "project");
  const authenticProjectImageCount = projects.filter((project) => project.hasAuthenticImage).length;
  return {
    narrativeSectionCount: narrative.length,
    narrativeCharacterCount: narrative.reduce((total, section) => total + section.characterCount, 0),
    serviceCount: units.filter((unit) => unit.kind === "service_capability").length,
    productFeatureCount: units.filter((unit) => unit.kind === "product_feature").length,
    useCaseCount: units.filter((unit) => unit.kind === "use_case").length,
    productTechSignal,
    projectCount: projects.length,
    authenticProjectImageCount,
    authenticProjectImageCoverage: projects.length === 0 ? 0 : authenticProjectImageCount / projects.length,
    totalContentUnitCount: units.length,
  };
};

export const createContentShape = (
  units: readonly NormalizedContentUnit[],
  semantics: SemanticContentDescriptor | null = null,
  productTechSignal = false,
): ContentShape => ({ facts: deriveDeterministicContentFacts(units, productTechSignal), semantics });
