export type PageRole =
  | "cover"
  | "narrative"
  | "capabilities"
  | "project_feature"
  | "project_grid"
  | "continuation";

export type TemplateFontStyle =
  | "normal"
  | "bold"
  | "italic"
  | "bolditalic";

export type ImageRole = "contextual_stock" | "project_image" | "company_logo";

export type ImageProvenance =
  | "pexels"
  | "user_upload"
  | "ai_generated_fictional_poc_test_asset";

type TemplateSlotBase = {
  id: string;
  path: string;
  required: boolean;
};

export type TextSlotEnvelope = TemplateSlotBase & {
  kind: "text";
  fontFamily: string;
  fontStyle: TemplateFontStyle;
  fontSize: number;
  widthMm: number;
  maxLines: number;
};

export type CollectionSlotEnvelope = TemplateSlotBase & {
  kind: "collection";
  minItems: number;
  maxItems: number;
};

export type ImageSlotEnvelope = TemplateSlotBase & {
  kind: "image";
  allowedRoles: readonly ImageRole[];
  allowedProvenances: readonly ImageProvenance[];
  minimumAspectRatio?: number;
  maximumAspectRatio?: number;
};

export type TemplateSlot =
  | TextSlotEnvelope
  | CollectionSlotEnvelope
  | ImageSlotEnvelope;

export type ContentEnvelope = {
  slots: readonly TemplateSlot[];
};

export type ContractIssueCode =
  | "required_slot_missing"
  | "invalid_slot_type"
  | "text_line_limit_exceeded"
  | "text_word_width_exceeded"
  | "collection_below_minimum"
  | "collection_above_maximum"
  | "image_role_not_allowed"
  | "image_provenance_not_allowed"
  | "image_dimensions_invalid"
  | "image_aspect_ratio_below_minimum"
  | "image_aspect_ratio_above_maximum"
  | "image_project_association_mismatch"
  | "duplicate_content_consumption";

export type ContractIssue = {
  code: ContractIssueCode;
  path: string;
  slotId: string;
  message: string;
};

export type TextMeasurementRequest = {
  text: string;
  fontFamily: string;
  fontStyle: TemplateFontStyle;
  fontSize: number;
  widthMm: number;
};

export type MeasurementContext = {
  wrapText(request: TextMeasurementRequest): readonly string[];
};

export type ImageSlotValue = {
  role: ImageRole;
  provenance: ImageProvenance;
  format: "PNG" | "JPEG";
  width: number;
  height: number;
  source: string;
};

export type PreparedTextSlot = {
  kind: "text";
  source: string;
  lines: readonly string[];
};

export type PreparedCollectionSlot = {
  kind: "collection";
  source: readonly unknown[];
};

export type PreparedImageSlot = {
  kind: "image";
  source: ImageSlotValue;
  aspectRatio: number;
};

export type PreparedTemplateSlot =
  | PreparedTextSlot
  | PreparedCollectionSlot
  | PreparedImageSlot;

export type TemplateInstance<TSource extends object = Record<string, unknown>> = {
  templateId: string;
  source: TSource;
  preparedSlots: Readonly<Record<string, PreparedTemplateSlot>>;
  consumedContentIds: readonly string[];
};

export type TemplateCompatibilityResult<
  TSource extends object = Record<string, unknown>,
> =
  | {
      compatible: true;
      instance: TemplateInstance<TSource>;
      issues: [];
    }
  | {
      compatible: false;
      instance: null;
      issues: ContractIssue[];
    };

export type TemplateFamily =
  | "editorial_cover"
  | "editorial_narrative"
  | "editorial_capabilities"
  | "editorial_project_feature"
  | "corporate_cover"
  | "corporate_narrative"
  | "corporate_services"
  | "product_cover"
  | "product_overview"
  | "product_features"
  | "product_use_cases";

export type TemplateRenderAudit = {
  templateId: string;
  renderedTextBySlot: Readonly<Record<string, readonly string[]>>;
};

export type AuthoredPageTemplate<TInput extends object> = {
  id: string;
  pageRole: PageRole;
  family: TemplateFamily;
  priority: number;
  envelope: ContentEnvelope;
  prepare(input: TInput): TemplateCompatibilityResult<TInput>;
  render(
    pdf: import("jspdf").jsPDF,
    instance: TemplateInstance<TInput>,
  ): TemplateRenderAudit;
};

export type TemplatePackVisualSystem = {
  page: { width: 210; height: 297; unit: "mm" };
  fonts: Readonly<Record<string, { family: string; style: TemplateFontStyle; size: number }>>;
  palette: Readonly<Record<string, readonly [number, number, number]>>;
};

export type TemplatePack = {
  id: string;
  version: number;
  pageOrder: readonly string[];
  visualSystem: TemplatePackVisualSystem;
  templates: readonly AuthoredPageTemplate<object>[];
};
