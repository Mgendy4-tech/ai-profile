import type { ImageSlotValue } from "../../types";

export type CoverContent = {
  contentId: string;
  documentLabel: string;
  companyName: string;
  hero: ImageSlotValue;
  logo?: ImageSlotValue;
};

export type NarrativeContent = {
  contentId: string;
  title: string;
  body: string;
  facts?: readonly NarrativeFact[];
  secondaryBlock?: { title?: string; body: string };
  callout?: { text: string; label?: string };
};

export type NarrativeFact = { value: string; label: string };

export type CapabilityContent = {
  index: string;
  title: string;
  description: string;
  items: readonly string[];
};

export type CapabilitiesContent = {
  contentId: string;
  eyebrow: string;
  heading: string;
  supportingLine: string;
  capabilities: readonly [
    CapabilityContent,
    CapabilityContent,
    CapabilityContent,
    CapabilityContent,
  ];
};

export type CapabilitiesSupportingContent = {
  contentId: string;
  eyebrow: string;
  heading: string;
  capabilities: readonly [CapabilityContent, CapabilityContent];
  detail: { contentId: string; title: string; body: string };
  projectTransition?: {
    label: "NEXT / FEATURED PROJECT" | "NEXT / SELECTED WORK";
    projects: readonly { contentId: string; title: string }[];
  };
};

export type ProjectFeatureContent = {
  contentId: string;
  title: string;
  hero: ImageSlotValue;
  info?: readonly [
    { label: string; value: string },
    { label: string; value: string },
    { label: string; value: string },
  ];
  overviewBody: string;
  scope?: { title?: string; items: readonly string[] };
};

export type EditorialInteriorsV1DocumentInput = {
  cover: CoverContent;
  narrative: NarrativeContent;
  capabilities: CapabilitiesContent;
  projectFeature: ProjectFeatureContent;
};
