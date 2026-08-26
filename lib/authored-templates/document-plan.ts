import type { AuthoredDocumentPlan } from "./library-types";
import type { TemplatePack } from "./types";

export type DocumentPlanStructureIssue = {
  code: "pack_not_registered" | "template_not_registered" | "template_role_mismatch" | "layout_parameter_not_allowed";
  path: string;
  message: string;
};

const ROOT_KEYS = new Set(["familyId", "packId", "pages"]);
const PAGE_KEYS = new Set(["pageId", "templateId", "pageRole", "candidate", "claims"]);
const FORBIDDEN_LAYOUT_KEYS = new Set(["x", "y", "width", "height", "spacing", "fontSize", "columns", "ratio", "geometry", "layout"]);

export const validateAuthoredDocumentPlan = (
  plan: AuthoredDocumentPlan,
  packs: readonly TemplatePack[],
): readonly DocumentPlanStructureIssue[] => {
  const issues: DocumentPlanStructureIssue[] = [];
  Object.keys(plan).forEach((key) => {
    if (!ROOT_KEYS.has(key) || FORBIDDEN_LAYOUT_KEYS.has(key)) issues.push({ code: "layout_parameter_not_allowed", path: key, message: `Document plans cannot contain ${key}.` });
  });
  const pack = packs.find((candidate) => candidate.id === plan.packId);
  if (!pack) issues.push({ code: "pack_not_registered", path: "packId", message: `Pack ${plan.packId} is not registered.` });
  plan.pages.forEach((page, index) => {
    Object.keys(page).forEach((key) => {
      if (!PAGE_KEYS.has(key) || FORBIDDEN_LAYOUT_KEYS.has(key)) issues.push({ code: "layout_parameter_not_allowed", path: `pages.${index}.${key}`, message: `Page plans cannot contain ${key}.` });
    });
    const template = pack?.templates.find((candidate) => candidate.id === page.templateId);
    if (!template) issues.push({ code: "template_not_registered", path: `pages.${index}.templateId`, message: `Template ${page.templateId} is not registered in pack ${plan.packId}.` });
    else if (template.pageRole !== page.pageRole) issues.push({ code: "template_role_mismatch", path: `pages.${index}.pageRole`, message: `Template ${page.templateId} does not support ${page.pageRole}.` });
  });
  return issues;
};
