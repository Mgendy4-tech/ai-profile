import type { TemplateFamilyId } from './library-types';

export type FamilyChoice = { id: TemplateFamilyId; label: string; description: string; eligible: boolean; reason?: string; recommended: boolean };

export const familyChoices = (input: { projectCount: number; authenticProjectImageCount: number; serviceCount: number; productFeatureCount: number; useCaseCount: number }): FamilyChoice[] => {
  const visualEligible = input.projectCount > 0 && input.authenticProjectImageCount === input.projectCount;
  const productEligible = input.productFeatureCount >= 3 && input.useCaseCount >= 1;
  const corporateEligible = input.serviceCount >= 3;
  const scores = { 'visual-portfolio': (visualEligible ? 4 : -5) + input.projectCount, 'corporate-services': (corporateEligible ? 3 : -2) + input.serviceCount, 'product-tech': (productEligible ? 4 : -2) + input.productFeatureCount + input.useCaseCount };
  const recommended = (Object.keys(scores) as (keyof typeof scores)[]).sort((a,b) => scores[b] - scores[a] || a.localeCompare(b))[0];
  return [
    { id: 'visual-portfolio', label: 'VISUAL / PORTFOLIO', description: 'Best for project-led / image-rich businesses.', eligible: visualEligible, reason: visualEligible ? undefined : 'Requires authentic project imagery for every project.', recommended: recommended === 'visual-portfolio' },
    { id: 'corporate-services', label: 'CORPORATE / SERVICES', description: 'Best for consulting and professional-service businesses.', eligible: corporateEligible, reason: corporateEligible ? undefined : 'Requires at least three source-backed services.', recommended: recommended === 'corporate-services' },
    { id: 'product-tech', label: 'PRODUCT / TECH', description: 'Best for technology/products/features/use cases.', eligible: productEligible, reason: productEligible ? undefined : 'Requires product features and at least one use case.', recommended: recommended === 'product-tech' },
  ];
};
