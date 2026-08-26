export type ProductTechCoverContent = { contentId: string; documentLabel: string; companyName: string; companyType: string };
export type ProductOverviewContent = { contentId: string; title: string; body: string; supportingLine: string };
export type ProductFeature = { contentId: string; index: string; title: string; description: string };
export type ProductFeaturesPageContent = { contentId: string; heading: string; supportingLine: string; features: readonly ProductFeature[] };
export type ProductUseCase = { contentId: string; index: string; title: string; description: string };
export type ProductUseCasesPageContent = { contentId: string; heading: string; supportingLine: string; useCases: readonly ProductUseCase[] };
