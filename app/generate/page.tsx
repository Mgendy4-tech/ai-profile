"use client";

import Link from "next/link";
import jsPDF from "jspdf";
import { useRef, useState } from "react";
import type {
  BrandAnalysis,
  PageCompositionPlan,
  SelectedContextualVisual,
  SelectVisualsResponse,
  VisualDirection,
} from "@/lib/visual-system/types";
import { pageCompositionPlanSchema } from "@/lib/visual-system/page-composition-plan";
import {
  resolvePageComposition,
  type ResolvedPageComposition,
} from "@/lib/visual-system/composition-resolver";
import {
  createCoverEditorialLayout,
  drawCoverEditorial,
  getCoverEditorialActivation,
  type CoverEditorialActivation,
} from "@/lib/visual-system/pdf-cover-editorial";
import {
  createNarrativePageLayout,
  drawNarrativePage,
  getNarrativePageActivation,
  prepareNarrativePage,
  type NarrativeCompositionVariant,
} from "@/lib/visual-system/pdf-narrative-composition";
import {
  createPDFDesignTokens,
  resolvePagePalette,
  type PDFPageMode,
} from "@/lib/visual-system/pdf-design-tokens";
import {
  drawProjectPage,
  getProjectPageActivation,
  prepareProjectPage,
  type ProjectPortfolioItem,
} from "@/lib/visual-system/pdf-project-composition";
import type { PDFCompositionFamily } from "@/lib/visual-system/pdf-art-direction";
import { resolvePDFCreditPlacement } from "@/lib/visual-system/pdf-image-credits";
import { validateRenderedDocumentLimits } from "@/lib/production-limits";
import { classifyAuthoredFallbackReason, routeEditorialInteriorsV1Export } from "@/lib/authored-templates/export-orchestrator";
import { emitProductionTelemetry } from "@/lib/production-telemetry";
import {
  createDevelopmentExportEventSink,
  createExportAttemptGuard,
  createExportReferenceId,
  emitExportCompleted,
  emitExportFailed,
  emitExportStarted,
  type ExportFallbackDiagnostic,
} from "@/lib/export-beta-lifecycle";
import {
  calculateAspectFillCrop,
  canUseContextualVisualInBlock,
  isCompanyIntroductionSection,
  selectContextualVisual,
} from "@/lib/visual-system/pdf-visual-helpers";
import {
  createStableCustomSectionId,
  generatedSectionsErrorMessage,
  structuredSectionContract,
  persistApprovedProfileStructure,
  validateGeneratedProfileSections,
} from "@/lib/generated-profile-boundary";
import {
  addApprovedStructuredItem,
  deleteApprovedServiceItem,
  editApprovedSection,
  editApprovedStructuredItem,
  moveApprovedServiceItem,
  validateApprovedStructure,
  type EditableProfileStructure,
  type StructureEditResult,
} from "@/lib/profile-structure-editor";
import { analyzedStructureErrorMessage, validateAnalyzedProfileStructure } from "@/lib/profile-structure-boundary";
import { companySemanticText, companySourceMaterial, normalizeCompanyData, type CompanyData } from "@/lib/company-data";

type Project = {
  id?: string;
  name: string;
  description: string;
  imageUrl?: string;
};

type GeneratedProfile = {
  companyName: string;
  logoUrl?: string;
  companyType: string;
  sections: GeneratedSection[];

  // Legacy fields - keep temporarily
  about: string;
  expertise: string[];
  experience: string;
  projects: Project[];
  reasons: string[];
};

type GeneratedSection = {
  id: string;
  title: string;
  description: string;
  content: string;
  items: {
    id?: string;
    name: string;
    description: string;
    sourceEvidence?: string;
    imageUrl?: string;
  }[];
};

type ProfileSection = {
  id: string;
  displayTitle: string;
  description: string;
  semanticRole?: string;
  items?: readonly { id: string; title: string; description: string }[];
};

type ProfileStructure = {
  companyType: string;
  recommendedSections: ProfileSection[];
};

type PdfLayoutBlock = {
  type:
    | "header"
    | "textSection"
    | "fullWidthSection"
    | "twoColumnSection"
    | "projectGrid"
    | "projectFeature";
  sectionId?: string;
  projectNames?: string[];
};

type PdfLayoutPlan = {
  version: 1;
  blocks: PdfLayoutBlock[];
  pageCompositionPlan?: PageCompositionPlan;
};

const exportEventSink = createDevelopmentExportEventSink();

const isPdfLayoutPlan = (value: unknown): value is PdfLayoutPlan => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const plan = value as {
    version?: unknown;
    blocks?: unknown;
    pageCompositionPlan?: unknown;
  };
  return plan.version === 1
    && Array.isArray(plan.blocks)
    && plan.blocks.every((block) => {
      if (!block || typeof block !== "object") {
        return false;
      }

      const candidate = block as PdfLayoutBlock;
      return [
        "header",
        "textSection",
        "fullWidthSection",
        "twoColumnSection",
        "projectGrid",
        "projectFeature",
      ].includes(candidate.type)
        && (candidate.type === "header" || typeof candidate.sectionId === "string");
    })
    && (
      plan.pageCompositionPlan === undefined ||
      pageCompositionPlanSchema.safeParse(plan.pageCompositionPlan).success
    );
};

const createFallbackPdfLayoutPlan = (profile: GeneratedProfile): PdfLayoutPlan => ({
  version: 1,
  blocks: [
    { type: "header" },
    ...profile.sections.map((section) =>
      section.id === "projects"
        ? {
            type: "projectGrid" as const,
            sectionId: section.id,
            projectNames: section.items.map((item) => item.name),
          }
        : { type: "fullWidthSection" as const, sectionId: section.id },
    ),
  ],
});

const polishProjectDescription = (description: string) => {
  const sentences = description
    .trim()
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 3);

  return sentences
    .map((sentence) => /[.!?]$/.test(sentence) ? sentence : `${sentence}.`)
    .join(" ");
};

const getProjectDescription = (project: Project) => {
  const projectName = project.name.toLowerCase();

  if (projectName.includes("new cairo") && projectName.includes("villa")) {
    return "Premium marble and granite supply and installation for a luxury residential villa in New Cairo, covering flooring, stairs, wall cladding, kitchens and bathrooms with a focus on quality materials and precise finishing.";
  }

  if (projectName.includes("luxury residential")) {
    return "Complete marble and granite works for a high-end residential project, including flooring, stairs, countertops and decorative applications, with emphasis on premium materials and precise installation.";
  }

  if (projectName.includes("commercial") || projectName.includes("construction")) {
    return "Marble and granite supply and installation for commercial and construction applications, delivering durable materials, accurate installation and professional finishing tailored to project requirements.";
  }

  return polishProjectDescription(project.description);
};

const loadPdfImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load project image"));
    image.src = src;
  });

const getPdfImageSource = (image: HTMLImageElement) => {
  if (!image.naturalWidth || !image.naturalHeight) {
  throw new Error("Invalid image dimensions");
}

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d")?.drawImage(image, 0, 0);
  return canvas.toDataURL("image/png");
};

const getAspectFillPdfImageSource = (
  image: HTMLImageElement,
  frameWidth: number,
  frameHeight: number
) => {
  const crop = calculateAspectFillCrop(
    image.naturalWidth,
    image.naturalHeight,
    frameWidth,
    frameHeight
  );

  if (!crop) {
    throw new Error("Invalid project image crop geometry");
  }

  const canvas = document.createElement("canvas");
  const outputWidth = Math.min(1800, Math.max(1, image.naturalWidth));
  const outputHeight = Math.max(1, Math.round(outputWidth * frameHeight / frameWidth));
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Could not prepare project image crop");
  }

  context.drawImage(
    image,
    crop.sourceX,
    crop.sourceY,
    crop.sourceWidth,
    crop.sourceHeight,
    0,
    0,
    outputWidth,
    outputHeight
  );

  return canvas.toDataURL("image/jpeg", 0.9);
};

const loadContextualPdfImage = async (
  src: string,
  frameWidth: number,
  frameHeight: number
): Promise<string | null> => {
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      const timeout = window.setTimeout(
        () => reject(new Error("Contextual image timed out")),
        10000
      );

      element.crossOrigin = "anonymous";
      element.onload = () => {
        window.clearTimeout(timeout);
        resolve(element);
      };
      element.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Could not load contextual image"));
      };
      element.src = src;
    });

    const crop = calculateAspectFillCrop(
      image.naturalWidth,
      image.naturalHeight,
      frameWidth,
      frameHeight
    );

    if (!crop) {
      return null;
    }

    const canvas = document.createElement("canvas");
    const outputWidth = Math.min(1800, Math.max(1, image.naturalWidth));
    const outputHeight = Math.max(
      1,
      Math.round(outputWidth * (frameHeight / frameWidth))
    );
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    context.drawImage(
      image,
      crop.sourceX,
      crop.sourceY,
      crop.sourceWidth,
      crop.sourceHeight,
      0,
      0,
      outputWidth,
      outputHeight
    );

    return canvas.toDataURL("image/jpeg", 0.88);
  } catch {
    return null;
  }
};

const postJsonWithTimeout = async <T,>(
  url: string,
  body: unknown,
  timeoutMs: number
): Promise<T> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Request to ${url} failed.`);
    }

    return data as T;
  } finally {
    window.clearTimeout(timeout);
  }
};

export default function GeneratePage() {
  const [profile, setProfile] = useState<GeneratedProfile | null>(null);
const [profileStructure, setProfileStructure] =
  useState<ProfileStructure | null>(null);
const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
const [structureConfirmed, setStructureConfirmed] = useState(false);
const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
const [editingSectionTitle, setEditingSectionTitle] = useState("");
const [editingSectionDescription, setEditingSectionDescription] = useState("");
const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const exportAttemptGuard = useRef(createExportAttemptGuard());
  const [errorMessage, setErrorMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [exportMessageTone, setExportMessageTone] = useState<"status" | "success" | "error">("status");

const persistStructureSnapshot = (structure: ProfileStructure, sectionIds: readonly string[] = selectedSectionIds) => {
  const rawCompany = localStorage.getItem("companyData");
  if (!rawCompany) return;
  persistApprovedProfileStructure(localStorage, JSON.parse(rawCompany), structure, sectionIds);
};
const commitStructure = (update: (current: ProfileStructure) => ProfileStructure) => {
  setProfileStructure((current) => {
    if (!current) return current;
    const next = update(current);
    persistStructureSnapshot(next);
    return next;
  });
  setStructureConfirmed(false);
};
const applyStructureEdit = (result: StructureEditResult) => {
  if (!result.valid) { setErrorMessage(result.error); return; }
  setErrorMessage("");
  commitStructure(() => result.structure as ProfileStructure);
};

const handleAnalyze = async () => {
  setLoading(true);
  setErrorMessage("");

  try {
    const savedCompanyData = localStorage.getItem("companyData");
    const savedProjectsData = localStorage.getItem("projectsData");
    if (!savedCompanyData) {
      throw new Error("Please save your company information first.");
    }

    const companyData = normalizeCompanyData(JSON.parse(savedCompanyData));

    if (!companyData.name?.trim() || !companyData.about?.trim()) {
      throw new Error("Please complete your company information first.");
    }

    const projects = savedProjectsData
      ? (JSON.parse(savedProjectsData) as Project[]).filter(
          (project) =>
            project.name?.trim() && project.description?.trim(),
        )
      : [];

    const response = await fetch("/api/analyze-structure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company: companySemanticText(companyData),
        projects: projects.map(({ imageUrl, ...project }) => project),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to analyze company structure.");
    }

const validatedStructure = validateAnalyzedProfileStructure(data);
if (!validatedStructure.valid) throw new Error(analyzedStructureErrorMessage);
const approvedAnalysis = validatedStructure.structure;
    setProfileStructure(approvedAnalysis);
setSelectedSectionIds(
  approvedAnalysis.recommendedSections.map((section: ProfileSection) => section.id)
);
setStructureConfirmed(false);
    localStorage.setItem(
      "profileStructure",
      JSON.stringify({
        companyData,
        analysis: approvedAnalysis,
        selectedSections: approvedAnalysis.recommendedSections,
      }),
    );
  } catch (error) {
    setErrorMessage(
      error instanceof Error
        ? error.message
        : "Failed to analyze company structure.",
    );
  } finally {
    setLoading(false);
  }
};

  const handleGenerate = () => {
    setLoading(true);
    setErrorMessage("");
    setCopyMessage("");

    window.setTimeout(async() => {
      try {
        const savedCompanyData = localStorage.getItem("companyData");
        const savedProjectsData = localStorage.getItem("projectsData");

        if (!savedCompanyData) {
          setProfile(null);
          setErrorMessage("Please save your company information before generating a profile.");
          return;
        }

        const companyData = normalizeCompanyData(JSON.parse(savedCompanyData));
        if (!companyData.name?.trim() || !companyData.about?.trim()) {
          setProfile(null);
          setErrorMessage("Please complete your company information before generating a profile.");
          return;
        }
if (!profileStructure) {
  setProfile(null);
  setErrorMessage("Please analyze the company structure before generating the profile.");
  return;
}

persistApprovedProfileStructure(
  localStorage,
  companyData,
  profileStructure,
  selectedSectionIds,
);
const persistedStructure = JSON.parse(localStorage.getItem("profileStructure") ?? "null") as { selectedSections?: ProfileSection[] } | null;
const selectedSections = persistedStructure?.selectedSections ?? [];
const structureError = validateApprovedStructure(profileStructure);
if (structureError) throw new Error(structureError);
          const projects = savedProjectsData
          ? (JSON.parse(savedProjectsData) as Project[]).filter(
              (project) => project.name?.trim() && project.description?.trim(),
            ).map((project) => ({
              ...project,
              description: getProjectDescription(project),
            }))
          : [];
        const expertise = [
          "Marble & Granite Supply",
          "Marble & Granite Installation",
          "Construction Projects",
        ];
        const about = companyData.about.trim().replace(/\s+/g, " ");
        const reasons = [
          "24 years of practical experience in marble and granite works.",
          "Proven experience across residential, commercial and construction projects.",
          "Commitment to quality materials and precise workmanship.",
          "Professional execution tailored to each project's requirements.",
        ];
const response = await fetch("/api/generate-profile", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
  company: companySemanticText(companyData),

  selectedSections,

  projects: projects.map(({ imageUrl, ...project }) => project),
}),
});

const data = await response.json();

if (!response.ok) {
  throw new Error(data.error || "Failed to generate profile.");
}

const validatedSections = validateGeneratedProfileSections(
  selectedSections,
  data.sections,
  {
    serviceSourceMaterial: companySourceMaterial(companyData),
    productSourceMaterial: companySourceMaterial(companyData),
    productTech: /saas|software|platform|technology|tech|digital product|ai company/i.test(data.companyType),
  },
);
if (!validatedSections.valid) {
  throw new Error(generatedSectionsErrorMessage);
}

setProfile({
  companyName: companyData.name.trim(),
  logoUrl: companyData.logoUrl,

  companyType: data.companyType,
  sections: validatedSections.sections.map((section: GeneratedSection) => ({
    ...section,
    items: (section.items || []).map((item: GeneratedSection["items"][number]) => ({
      ...item,
      imageUrl:
        projects.find((project) => project.name === item.name)?.imageUrl,
    })),
  })),

  // Keep old fields temporarily so the existing preview/PDF still works
  about:
    validatedSections.sections.find((section: GeneratedSection) => section.id === "about")
      ?.content || "",

  expertise: validatedSections.sections
    .find((section: GeneratedSection) => section.id === "expertise")
    ?.items?.map(
  (item: GeneratedSection["items"][number]) => item.name
) || [],

  experience:
    validatedSections.sections.find(
      (section: GeneratedSection) => section.id === "experience",
    )?.content || "",

  projects: (validatedSections.sections.find(
    (section: GeneratedSection) => section.id === "projects",
  )?.items || []).map((item: GeneratedSection["items"][number]) => ({
    name: item.name,
    description: item.description,
    imageUrl: projects.find((project) => project.name === item.name)?.imageUrl,
  })),

  reasons:
    validatedSections.sections
      .find((section: GeneratedSection) => section.id === "whyChoose")
      ?.items?.map(
  (item: GeneratedSection["items"][number]) => item.name
) || [],
});

      } catch (error) {
        setProfile(null);
        setErrorMessage(error instanceof Error ? error.message : "We could not generate a complete company profile.");
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  const getProfileText = () => {
    if (!profile) {
      return "";
    }

    return [
      "ABOUT US",
      profile.about,
      "OUR EXPERTISE",
      profile.expertise.map((item) => `- ${item}`).join("\n"),
      "OUR EXPERIENCE",
      profile.experience,
      "FEATURED PROJECTS",
      profile.projects.length
        ? profile.projects
            .map((project) => `${project.name}\n${project.description}`)
            .join("\n\n")
        : "No projects have been added yet.",
      "WHY CHOOSE US",
      profile.reasons.map((reason) => `- ${reason}`).join("\n"),
    ].join("\n\n");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getProfileText());
      setCopyMessage("Profile copied.");
    } catch {
      setCopyMessage("Unable to copy the profile.");
    }
  };

  const handleExportPdf = async () => {
    if (!profile || !exportAttemptGuard.current.tryStart()) {
      return;
    }

    const exportEventId = createExportReferenceId();
    const exportStartedAt = Date.now();
    let fallbackDiagnostics: readonly ExportFallbackDiagnostic[] = [];
    emitExportStarted(exportEventSink, exportEventId, exportStartedAt);
    setIsExporting(true);
    setExportMessageTone("status");
    setExportMessage("Creating your company profile…");

    try {
      const fallbackLayoutPlan = createFallbackPdfLayoutPlan(profile);
      let layoutPlan = fallbackLayoutPlan;
      let selectedContextualVisuals: SelectedContextualVisual[] = [];
      let pdfBrandAnalysis: BrandAnalysis | null = null;

      let companyData: Partial<CompanyData> = {
        name: profile.companyName,
        logoUrl: profile.logoUrl,
      };
      const savedCompanyData = localStorage.getItem("companyData");

      if (savedCompanyData) {
        try {
          const parsedCompanyData = JSON.parse(savedCompanyData);
          if (parsedCompanyData && typeof parsedCompanyData === "object") {
            companyData = normalizeCompanyData(parsedCompanyData);
          }
        } catch {
          companyData = { name: profile.companyName, logoUrl: profile.logoUrl };
        }
      }

      const savedProjects = localStorage.getItem("projectsData");
      let authoredProjects: Array<{
        id: string;
        name: string;
        category?: string;
        description: string;
        imageUrl: string;
      }> = [];
      if (savedProjects) {
        try {
          const parsedProjects: unknown = JSON.parse(savedProjects);
          if (Array.isArray(parsedProjects)) {
            authoredProjects = parsedProjects.flatMap((project) => {
              if (!project || typeof project !== "object") return [];
              const candidate = project as Record<string, unknown>;
              return typeof candidate.id === "string" &&
                typeof candidate.name === "string" &&
                typeof candidate.description === "string" &&
                typeof candidate.imageUrl === "string"
                ? [{
                    id: candidate.id,
                    name: candidate.name,
                    category: typeof candidate.category === "string" ? candidate.category : undefined,
                    description: candidate.description,
                    imageUrl: candidate.imageUrl,
                  }]
                : [];
            });
          }
        } catch {
          authoredProjects = [];
        }
      }

      const authoredDecision = await routeEditorialInteriorsV1Export({
        company: {
          name: typeof companyData.name === "string" ? companyData.name : profile.companyName,
          logoUrl: typeof companyData.logoUrl === "string" ? companyData.logoUrl : profile.logoUrl,
          about: typeof companyData.about === "string" ? companyData.about : profile.about,
          activities: typeof companyData.activities === "string" ? companyData.activities : profile.expertise.join("\n"),
          experience: typeof companyData.experience === "string" ? companyData.experience : profile.experience,
        },
        profile: {
          companyName: profile.companyName,
          companyType: profile.companyType,
          sections: profile.sections,
        },
        projects: authoredProjects,
      });
      if (process.env.NODE_ENV !== "production") {
        console.debug("[authored-export-decision]", {
          mode: authoredDecision.mode,
          familyId: authoredDecision.familyId,
          packId: authoredDecision.packId,
          reasons: authoredDecision.reasons.map((reason) => ({
            stage: reason.stage,
            code: reason.code,
            path: reason.path,
            pageRole: reason.pageRole,
          })),
        });
      }
      if (authoredDecision.mode === "authored") {
        const pdfBytes = authoredDecision.pdf.output("arraybuffer").byteLength;
        emitProductionTelemetry({ name: "family_selected", familyId: authoredDecision.familyId, packId: authoredDecision.packId });
        emitProductionTelemetry({ name: "export_succeeded", familyId: authoredDecision.familyId, packId: authoredDecision.packId, latencyMs: Date.now() - exportStartedAt, pdfBytes, pageCount: authoredDecision.pdf.getNumberOfPages() });
        authoredDecision.pdf.save(`${profile.companyName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "company-profile"}.pdf`);
        emitExportCompleted(exportEventSink, exportEventId, exportStartedAt, Date.now(), "authored_success", authoredDecision.familyId, authoredDecision.pdf.getNumberOfPages());
        setExportMessageTone("success");
        setExportMessage("Your company profile is ready.");
        return;
      }
      fallbackDiagnostics = authoredDecision.reasons.map(({ stage, code, pageRole }) => ({ stage, code, pageRole }));
      const fallbackCategory = authoredDecision.reasons[0] ? classifyAuthoredFallbackReason(authoredDecision.reasons[0]) : "expected_unsupported_content_shape";
      emitProductionTelemetry({ name: "expected_fallback", failureClass: fallbackCategory === "authored_capacity_incompatibility" ? "operational_limit" : "expected_authored_incompatibility", category: fallbackCategory, reasonCodes: authoredDecision.reasons.map((reason) => reason.code) });
      const operationalFailure = authoredDecision.reasons.find((reason) => reason.stage === "operational");
      if (operationalFailure) {
        emitExportFailed(exportEventSink, exportEventId, exportStartedAt, Date.now());
        setExportMessageTone("error");
        setExportMessage(operationalFailure.code === "project_count_limit" ? "This profile exceeds the V1 project limit. Keep at most 12 projects and try again." : "One or more project images exceed the safe browser limits. Use PNG or JPEG images up to 3 MB each and keep the combined images within 3 MB.");
        return;
      }

      const visualCompany = {
        ...companySemanticText(normalizeCompanyData(companyData)),
        yearsOfExperience: companyData.experience,
      };

      try {
        const brandAnalysis = await postJsonWithTimeout<BrandAnalysis>(
          "/api/analyze-brand",
          { company: visualCompany },
          30000
        );
        pdfBrandAnalysis = brandAnalysis;

        try {
          const visualDirection = await postJsonWithTimeout<VisualDirection>(
            "/api/visual-direction",
            { company: visualCompany, brandAnalysis },
            30000
          );

          try {
            const selection = await postJsonWithTimeout<SelectVisualsResponse>(
              "/api/select-visuals",
              { visualDirection },
              60000
            );
            selectedContextualVisuals = selection.visuals;
          } catch {
            selectedContextualVisuals = [];
          }
        } catch {
          selectedContextualVisuals = [];
        }
      } catch {
        selectedContextualVisuals = [];
      }

      try {
        const plannerData = await postJsonWithTimeout<unknown>(
          "/api/plan-pdf-layout",
          {
            company: companySemanticText(normalizeCompanyData(companyData)),
            profile: {
              companyName: profile.companyName,
              companyType: profile.companyType,
              sections: profile.sections.map((section) => ({
                id: section.id,
                title: section.title,
                description: section.description,
                content: section.content,
                items: section.items.map((item) => ({ id: item.id, name: item.name, description: item.description, sourceEvidence: item.sourceEvidence })),
              })),
            },
            projects: profile.projects.map((project) => ({ name: project.name, description: project.description })),
            contextualVisuals: selectedContextualVisuals,
          },
          30000
        );

        if (!isPdfLayoutPlan(plannerData)) {
          throw new Error("Invalid PDF layout plan");
        }

        layoutPlan = plannerData;
      } catch {
        layoutPlan = fallbackLayoutPlan;
      }

      let coverActivation: CoverEditorialActivation | null = null;
      let resolvedPageComposition: ResolvedPageComposition | null = null;

      if (layoutPlan.pageCompositionPlan) {
        const resolvedComposition = resolvePageComposition(
          layoutPlan.pageCompositionPlan,
          {
            sectionIds: profile.sections.map((section) => section.id),
            projectNames: profile.projects.map((project) => project.name),
            contextualVisuals: selectedContextualVisuals,
          }
        );

        if (resolvedComposition.ok) {
          resolvedPageComposition = resolvedComposition.composition;
          coverActivation = getCoverEditorialActivation(
            resolvedComposition.composition
          );
        }
      }

      let pdf = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      const bottomMargin = 16;
      const topContent = 22;
      const pdfDesignTokens = createPDFDesignTokens(pdfBrandAnalysis);
      let y = topContent;
      let logo: HTMLImageElement | null = null;
      let logoSource: string | null = null;

      if (profile.logoUrl) {
        try {
          logo = await loadPdfImage(profile.logoUrl);
          logoSource = getPdfImageSource(logo);
        } catch {
          logo = null;
          logoSource = null;
        }
      }

      const heroVisual = selectContextualVisual(
        selectedContextualVisuals,
        "hero"
      );
      const aboutVisual = selectContextualVisual(
        selectedContextualVisuals,
        "contextual"
      );
      const heroFrameHeight = 105;
      const aboutImageWidth = 68;
      const aboutImageHeight = 55;
      const resolvedCoverLayout = coverActivation
        ? createCoverEditorialLayout(
            coverActivation.page,
            Boolean(coverActivation.heroVisual),
            coverActivation.heroVisual
          )
        : null;
      const resolvedCoverHero = coverActivation?.heroVisual ?? null;
      const v2HeroImageSource =
        resolvedCoverLayout?.heroArea && resolvedCoverHero?.imageUrl
          ? await loadContextualPdfImage(
              resolvedCoverHero.imageUrl,
              resolvedCoverLayout.heroArea.width,
              resolvedCoverLayout.heroArea.height
            )
          : null;
      let heroImageSource = !coverActivation && heroVisual?.imageUrl
        ? await loadContextualPdfImage(
            heroVisual.imageUrl,
            contentWidth,
            heroFrameHeight
          )
        : null;
      const aboutImageSource = aboutVisual?.imageUrl
        ? await loadContextualPdfImage(
            aboutVisual.imageUrl,
            aboutImageWidth,
            aboutImageHeight
          )
        : null;
      const renderedContextualVisuals: SelectedContextualVisual[] = [];

      const addHeader = () => {
        pdf.setTextColor(17, 24, 39);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text(profile.companyName, margin, 11);
        if (logo && logoSource) {
          const maxLogoWidth = 24;
          const maxLogoHeight = 9;
          const logoRatio = logo.naturalWidth / logo.naturalHeight;
          const logoHeight = Math.min(maxLogoHeight, maxLogoWidth / logoRatio);
          const logoWidth = logoHeight * logoRatio;
          pdf.addImage(logoSource, pageWidth - margin - logoWidth, 4, logoWidth, logoHeight);
        }
        pdf.setDrawColor(209, 213, 219);
        pdf.line(margin, 14, pageWidth - margin, 14);
      };

      const startNewPage = () => {
        pdf.addPage();
        addHeader();
        y = topContent;
      };

      const ensureSpace = (height: number) => {
        if (y + height > pageHeight - bottomMargin) {
          startNewPage();
        }
      };

      const addSectionHeading = (
        heading: string,
        followingHeight = 12,
        minimumFollowingHeight = 12,
      ) => {
        const headingGap = 11;
        const availableHeight = pageHeight - bottomMargin - y;
        const requiredHeight = headingGap + followingHeight;
        const minimumHeight = headingGap + minimumFollowingHeight;

        ensureSpace(
          requiredHeight <= availableHeight ? requiredHeight : minimumHeight,
        );
        pdf.setTextColor(17, 24, 39);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(16.5);
        pdf.text(heading, margin, y);
        pdf.setDrawColor(17, 24, 39);
        pdf.setLineWidth(0.6);
        pdf.line(margin, y + 4, margin + 18, y + 4);
        y += headingGap;
      };

      const addBodyText = (text: string, size = 11.5, lineHeight = 7.2) => {
        pdf.setTextColor(55, 65, 81);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(size);
        const lines = pdf.splitTextToSize(text, contentWidth) as string[];
        const availableHeight = pageHeight - bottomMargin - y;
        const linesPerPage = Math.max(1, Math.floor((availableHeight - 2) / lineHeight));

        for (let index = 0; index < lines.length; index += linesPerPage) {
          const pageLines = lines.slice(index, index + linesPerPage);
          pdf.text(pageLines, margin, y);
          y += pageLines.length * lineHeight + 4;

          if (index + linesPerPage < lines.length) {
            startNewPage();
          }
        }
      };

      let renderedV2Cover = false;
      const renderedV2SectionIds = new Set<string>();
      let previousV2PageMode: PDFPageMode | null = null;
      let previousNarrativeVariant: NarrativeCompositionVariant | null = null;
      let previousV2Family: PDFCompositionFamily | null = null;
      const renderedV2PageModes = new Map<number, PDFPageMode>();
      let lastContentPageNumber: number | null = null;
      let lastContentBottom = 0;
      let lastContentCreditX = margin;

      if (coverActivation) {
        try {
          const coverResult = drawCoverEditorial({
            pdf,
            page: coverActivation.page,
            companyName: profile.companyName,
            designTokens: pdfDesignTokens,
            heroImageSource: v2HeroImageSource,
            logo: logo && logoSource
              ? {
                  source: logoSource,
                  width: logo.naturalWidth,
                  height: logo.naturalHeight,
                }
              : null,
          });

          if (coverResult.renderedVisual) {
            renderedContextualVisuals.push(coverResult.renderedVisual);
          }
          previousV2PageMode = coverResult.pageMode;
          previousV2Family = coverResult.compositionFamily;

          renderedV2Cover = true;
          pdf.addPage();
          y = topContent;
        } catch {
          pdf = new jsPDF({ unit: "mm", format: "a4" });
          coverActivation = null;
          heroImageSource = heroVisual?.imageUrl
            ? await loadContextualPdfImage(
                heroVisual.imageUrl,
                contentWidth,
                heroFrameHeight
              )
            : null;
        }
      }

      if (renderedV2Cover && resolvedPageComposition) {
        const narrativePages = resolvedPageComposition.pages.slice(1);

        for (const [narrativeIndex, resolvedPage] of narrativePages.entries()) {
          const activation = getNarrativePageActivation(resolvedPage);

          if (!activation) {
            const projectActivation = getProjectPageActivation(resolvedPage);

            if (!projectActivation) {
              continue;
            }

            const projectSection = profile.sections.find(
              (section) => section.id === projectActivation.sectionId
            );

            if (!projectSection) {
              break;
            }

            const loadedProjectImages = new Map<string, HTMLImageElement>();
            const availableProjects: ProjectPortfolioItem[] = await Promise.all(
              projectSection.items.map(async (item) => {
                if (!item.imageUrl) {
                  return {
                    name: item.name,
                    description: item.description,
                    image: null,
                  };
                }

                try {
                  const image = await loadPdfImage(item.imageUrl);
                  loadedProjectImages.set(item.name, image);
                  return {
                    name: item.name,
                    description: item.description,
                    image: {
                      role: "project_image" as const,
                      provenance: "user_upload" as const,
                      source: getPdfImageSource(image),
                      width: image.naturalWidth,
                      height: image.naturalHeight,
                    },
                  };
                } catch {
                  return {
                    name: item.name,
                    description: item.description,
                    image: null,
                  };
                }
              })
            );
            const projectPageIndex = narrativeIndex + 1;
            const preparedProject = prepareProjectPage(
              pdf,
              projectActivation,
              availableProjects,
              pdfDesignTokens,
              projectPageIndex,
              previousV2PageMode,
              previousV2Family
            );

            if (!preparedProject) {
              break;
            }

            try {
              preparedProject.projects.forEach((project) => {
                const loadedImage = loadedProjectImages.get(project.name);

                if (project.image && project.imageArea && loadedImage) {
                  project.image.source = getAspectFillPdfImageSource(
                    loadedImage,
                    project.imageArea.width,
                    project.imageArea.height
                  );
                  project.image.width = project.imageArea.width;
                  project.image.height = project.imageArea.height;
                }
              });
            } catch {
              break;
            }

            const projectPageNumber = pdf.getNumberOfPages();

            try {
              const projectResult = drawProjectPage(
                pdf,
                preparedProject,
                profile.companyName,
                pdfDesignTokens
              );
              projectResult.consumedSectionIds.forEach((sectionId) => {
                renderedV2SectionIds.add(sectionId);
              });
              previousV2PageMode = preparedProject.pageMode;
              previousV2Family = preparedProject.artDirection.compositionFamily;
              renderedV2PageModes.set(
                projectPageNumber,
                preparedProject.pageMode
              );
              lastContentPageNumber = projectPageNumber;
              lastContentBottom = Math.max(
                ...preparedProject.projects.map((project) => project.bottom)
              );
              lastContentCreditX = preparedProject.contentArea.x;
              pdf.addPage();
              y = topContent;
            } catch {
              pdf.deletePage(projectPageNumber);
              pdf.addPage();
              y = topContent;
              break;
            }

            continue;
          }

          const pageIndex = narrativeIndex + 1;
          const imageLayout = createNarrativePageLayout(
            activation,
            Boolean(activation.visual),
            pageIndex,
            previousNarrativeVariant,
            previousV2PageMode,
            undefined,
            previousV2Family
          );
          const narrativeImageSource =
            imageLayout?.mediaArea && activation.visual?.imageUrl
              ? await loadContextualPdfImage(
                  activation.visual.imageUrl,
                  imageLayout.mediaArea.width,
                  imageLayout.mediaArea.height
                )
              : null;
          const prepared = prepareNarrativePage(
            pdf,
            activation,
            profile.sections.map((section) => ({
              id: section.id,
              title: section.title,
              content: section.content,
              items: section.items.map((item) => ({
                name: item.name,
                description: item.description,
              })),
            })),
            Boolean(narrativeImageSource),
            pdfDesignTokens,
            pageIndex,
            previousNarrativeVariant,
            previousV2PageMode,
            previousV2Family
          );

          if (!prepared) {
            break;
          }

          const narrativePageNumber = pdf.getNumberOfPages();

          try {
            const result = drawNarrativePage({
              pdf,
              prepared,
              companyName: profile.companyName,
              designTokens: pdfDesignTokens,
              imageSource: narrativeImageSource,
            });

            result.consumedSectionIds.forEach((sectionId) => {
              renderedV2SectionIds.add(sectionId);
            });
            if (result.renderedVisual) {
              renderedContextualVisuals.push(result.renderedVisual);
            }
            previousNarrativeVariant = prepared.layout.variant;
            previousV2PageMode = prepared.layout.pageMode;
            previousV2Family = prepared.layout.artDirection.compositionFamily;
            renderedV2PageModes.set(
              narrativePageNumber,
              prepared.layout.pageMode
            );
            lastContentPageNumber = narrativePageNumber;
            lastContentBottom = Math.max(
              ...prepared.sections.map((section) => section.bottom)
            );
            lastContentCreditX = prepared.layout.textArea.x;

            pdf.addPage();
            y = topContent;
          } catch {
            pdf.deletePage(narrativePageNumber);
            pdf.addPage();
            y = topContent;
            break;
          }
        }

        addHeader();
      } else {
        addHeader();
      }

      if (!renderedV2Cover && heroVisual && heroImageSource) {
        const frameY = y;
        const panelWidth = contentWidth * 0.44;
        const brandPalette = resolvePagePalette(pdfDesignTokens, "accent");

        pdf.addImage(
          heroImageSource,
          "JPEG",
          margin,
          frameY,
          contentWidth,
          heroFrameHeight
        );
        pdf.setFillColor(
          brandPalette.background[0],
          brandPalette.background[1],
          brandPalette.background[2]
        );
        pdf.rect(margin, frameY, panelWidth, heroFrameHeight, "F");
        pdf.setTextColor(
          brandPalette.primaryText[0],
          brandPalette.primaryText[1],
          brandPalette.primaryText[2]
        );
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.text("COMPANY PROFILE", margin + 8, frameY + 16);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(22);
        const coverNameLines = pdf.splitTextToSize(
          profile.companyName,
          panelWidth - 16
        ) as string[];
        pdf.text(coverNameLines, margin + 8, frameY + 32);
        y = frameY + heroFrameHeight + 14;
        renderedContextualVisuals.push(heroVisual);
      } else if (!renderedV2Cover) {
        pdf.setTextColor(17, 24, 39);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(25);
        pdf.text(profile.companyName, margin, y + 8);
        y += 21;
      }

      const projectColumnWidth = (contentWidth - 6) / 2;
      const cardPadding = 6;
      const imageAreaHeight = 55;
      const titleLineHeight = 5.8;
      const descriptionLineHeight = 4.8;
      const cardGap = 3;
      const rowGap = 10;

      const getCardMetrics = (item: GeneratedSection["items"][number], cardWidth: number) => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11.5);
        const titleLines = pdf.splitTextToSize(item.name, cardWidth - cardPadding * 2) as string[];
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9.5);
        const descriptionLines = pdf.splitTextToSize(item.description, cardWidth - cardPadding * 2) as string[];

        return {
          titleLines,
          descriptionLines,
          height: cardPadding * 2
            + imageAreaHeight
            + cardGap
            + titleLines.length * titleLineHeight
            + cardGap
            + descriptionLines.length * descriptionLineHeight,
        };
      };

      const sectionsById = new Map(profile.sections.map((section) => [section.id, section]));
      const renderedSectionIds = new Set(renderedV2SectionIds);
      const renderBlocks: {
        section: GeneratedSection;
        items: GeneratedSection["items"];
        feature: boolean;
        blockType: PdfLayoutBlock["type"];
      }[] = [];

      layoutPlan.blocks.forEach((block) => {
        if (block.type === "header" || !block.sectionId || renderedSectionIds.has(block.sectionId)) {
          return;
        }

        const section = sectionsById.get(block.sectionId);
        if (!section) {
          return;
        }

        const isProjectBlock = block.type === "projectGrid" || block.type === "projectFeature";
        const items = isProjectBlock && block.projectNames
          ? section.items.filter((item) => block.projectNames?.includes(item.name))
          : section.items;

        renderedSectionIds.add(section.id);
        renderBlocks.push({
          section,
          items,
          feature: block.type === "projectFeature",
          blockType: block.type,
        });
      });

      profile.sections.forEach((section) => {
        if (!renderedSectionIds.has(section.id)) {
          renderBlocks.push({
            section,
            items: section.items,
            feature: false,
            blockType: "fullWidthSection",
          });
        }
      });

      if (renderedV2Cover && renderBlocks.length === 0) {
        pdf.deletePage(pdf.getNumberOfPages());
      }

      for (const renderBlock of renderBlocks) {
        const { section } = renderBlock;
        const loadedItems = await Promise.all(
          renderBlock.items.map(async (item) => ({
            item,
            image: item.imageUrl ? await loadPdfImage(item.imageUrl) : null,
          })),
        );

        const firstItem = loadedItems[0];
        const firstItemWidth = renderBlock.feature || loadedItems.length === 1
          ? contentWidth
          : projectColumnWidth;
        const firstItemHeight = firstItem
          ? getCardMetrics(firstItem.item, firstItemWidth).height
          : 12;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(11.5);
        const aboutTextWidth = contentWidth - aboutImageWidth - 8;
        const aboutTextLines = section.content
          ? (pdf.splitTextToSize(section.content, aboutTextWidth) as string[])
          : [];
        const aboutCompositionHeight = Math.max(
          aboutImageHeight,
          aboutTextLines.length * 7.2
        ) + 4;
        const useAboutVisual = Boolean(
          aboutVisual &&
          aboutImageSource &&
          section.content &&
          canUseContextualVisualInBlock(renderBlock.blockType) &&
          isCompanyIntroductionSection(section.id, section.title) &&
          aboutCompositionHeight <= pageHeight - bottomMargin - topContent - 11
        );
        const firstContentHeight = section.content
          ? useAboutVisual
            ? aboutCompositionHeight
            : (pdf.splitTextToSize(section.content, contentWidth) as string[]).length * 7.2 + 4
          : firstItemHeight;

        addSectionHeading(
          section.title,
          section.content && firstItem
            ? firstContentHeight + firstItemHeight
            : firstContentHeight,
          section.content ? firstContentHeight : firstItemHeight,
        );

        if (section.content) {
          if (useAboutVisual && aboutVisual && aboutImageSource) {
            pdf.addImage(
              aboutImageSource,
              "JPEG",
              margin,
              y,
              aboutImageWidth,
              aboutImageHeight
            );
            pdf.setTextColor(55, 65, 81);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(11.5);
            pdf.text(aboutTextLines, margin + aboutImageWidth + 8, y);
            y += aboutCompositionHeight;
            renderedContextualVisuals.push(aboutVisual);
          } else {
            addBodyText(section.content, 11.5, 7.2);
          }
        }

        if (!loadedItems.length) {
          continue;
        }

        const columnCount = renderBlock.feature ? 1 : 2;
        for (let index = 0; index < loadedItems.length; index += columnCount) {
          const rowItems = loadedItems.slice(index, index + columnCount);
          const isSingleItemRow = renderBlock.feature || rowItems.length === 1;
          const cardWidth = isSingleItemRow ? contentWidth : projectColumnWidth;
          const cardHeights = rowItems.map(({ item }) => {
            return getCardMetrics(item, cardWidth).height;
          });
          const rowHeight = Math.max(...cardHeights);

          ensureSpace(rowHeight);
          const actualRowY = y;
          rowItems.forEach(({ item, image }, columnIndex) => {
            const cardX = isSingleItemRow ? margin : margin + columnIndex * (projectColumnWidth + 6);
            const cardMetrics = getCardMetrics(item, cardWidth);
            const { titleLines, descriptionLines } = cardMetrics;
            const cardHeight = isSingleItemRow ? cardMetrics.height : rowHeight;

            pdf.setFillColor(249, 250, 251);
            pdf.setDrawColor(229, 231, 235);
            pdf.roundedRect(cardX, actualRowY, cardWidth, cardHeight, 3, 3, "FD");

            if (image) {
              const imageSource = getPdfImageSource(image);
              const imageRatio = image.naturalWidth / image.naturalHeight;
              const imageWidth = cardWidth - cardPadding * 2;
              const renderedWidth = Math.min(imageWidth, imageAreaHeight * imageRatio);
              const renderedHeight = renderedWidth / imageRatio;

              pdf.addImage(
                imageSource,
                cardX + cardPadding + (imageWidth - renderedWidth) / 2,
                actualRowY + cardPadding + (imageAreaHeight - renderedHeight) / 2,
                renderedWidth,
                renderedHeight,
              );
            }

            pdf.setTextColor(17, 24, 39);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(11.5);
            pdf.text(titleLines, cardX + cardPadding, actualRowY + cardPadding + imageAreaHeight + cardGap + titleLineHeight);
            pdf.setTextColor(55, 65, 81);
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(9.5);
            pdf.text(
              descriptionLines,
              cardX + cardPadding,
              actualRowY + cardPadding + imageAreaHeight + cardGap + titleLines.length * titleLineHeight + cardGap + descriptionLineHeight,
            );
          });
          y = actualRowY + rowHeight + rowGap;
        }
      }

      if (renderBlocks.length > 0) {
        lastContentPageNumber = pdf.getNumberOfPages();
        lastContentBottom = y;
        lastContentCreditX = margin;
      }

      const creditedVisuals = renderedContextualVisuals.filter(
        (visual, index, visuals) =>
          visuals.findIndex((candidate) => candidate.briefId === visual.briefId) === index
      );

      if (creditedVisuals.length > 0) {
        const creditPlacement = resolvePDFCreditPlacement({
          credits: creditedVisuals,
          contentBottom: lastContentBottom,
          pageTop: topContent,
          safeBottom: pageHeight - 19,
        });
        if (!creditPlacement) {
          throw new Error("Unable to preserve required image attribution.");
        }
        if (creditPlacement.mode === "append" && lastContentPageNumber !== null) {
          pdf.setPage(lastContentPageNumber);
          y = creditPlacement.startY;
        } else {
          startNewPage();
          y = creditPlacement.startY;
          lastContentPageNumber = pdf.getNumberOfPages();
        }
        const creditPalette = resolvePagePalette(
          pdfDesignTokens,
          renderedV2PageModes.get(lastContentPageNumber) ?? "light"
        );
        pdf.setDrawColor(...creditPalette.divider);
        pdf.setLineWidth(pdfDesignTokens.rules.hairlineWidth);
        pdf.line(
          lastContentCreditX,
          y - 3,
          lastContentCreditX + pdfDesignTokens.rules.shortRuleWidth,
          y - 3
        );
        pdf.setTextColor(...creditPalette.secondaryText);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text("IMAGE CREDITS", lastContentCreditX, y);
        y += 8;
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);

        creditPlacement.lines.forEach((line) => {
          pdf.text(line, lastContentCreditX, y);
          y += 5;
        });
      }

      const totalPages = pdf.getNumberOfPages();
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        if (renderedV2Cover && pageNumber === 1) {
          continue;
        }

        pdf.setPage(pageNumber);
        const footerPalette = resolvePagePalette(
          pdfDesignTokens,
          renderedV2PageModes.get(pageNumber) ?? "light"
        );
        pdf.setDrawColor(
          footerPalette.divider[0],
          footerPalette.divider[1],
          footerPalette.divider[2]
        );
        pdf.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
        pdf.setTextColor(
          footerPalette.secondaryText[0],
          footerPalette.secondaryText[1],
          footerPalette.secondaryText[2]
        );
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text(profile.companyName, margin, pageHeight - 8);
        pdf.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
      }

      const legacyLimits = validateRenderedDocumentLimits(pdf.getNumberOfPages(), pdf.output("arraybuffer").byteLength);
      if (legacyLimits.length) throw new Error(legacyLimits[0].code);
      pdf.save(`${profile.companyName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "company-profile"}.pdf`);
      emitProductionTelemetry({ name: "export_succeeded", familyId: null, packId: null, latencyMs: Date.now() - exportStartedAt, pdfBytes: pdf.output("arraybuffer").byteLength, pageCount: pdf.getNumberOfPages() });
      emitExportCompleted(exportEventSink, exportEventId, exportStartedAt, Date.now(), "standard_success", null, pdf.getNumberOfPages(), fallbackDiagnostics);
      setExportMessageTone("success");
      setExportMessage("Your company profile is ready.");
    } catch (error) {
      emitProductionTelemetry({ name: "export_failed", failureClass: "export_failure", reasonCode: error instanceof Error && (error.message === "page_count_limit" || error.message === "pdf_byte_limit") ? error.message : "pdf_export_failed", latencyMs: Date.now() - exportStartedAt });
      emitExportFailed(exportEventSink, exportEventId, exportStartedAt, Date.now());
      setExportMessageTone("error");
      setExportMessage(error instanceof Error && (error.message === "page_count_limit" || error.message === "pdf_byte_limit") ? "This profile exceeds the safe V1 PDF size or page limit. Reduce optional content or image weight and try again." : `We couldn't create your PDF this time. Please try again. Reference: ${exportEventId}`);
    } finally {
      exportAttemptGuard.current.finish();
      setIsExporting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 sm:py-14">
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/30 px-4">
          <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-xl">
            <span
              aria-hidden="true"
              className="mx-auto block h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-900"
            />
            <h2 className="mt-5 text-xl font-semibold text-gray-900">
              {profileStructure || profile
                ? "Generating Company Profile"
                : "Analyzing Company Information"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Analyzing your company information and projects...
            </p>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          Generate Company Profile
        </h1>

        <p className="mt-3 max-w-2xl text-gray-600">
          Let AI create your professional company profile.
        </p>

        <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
            AI Profile Generator
          </h2>

          <p className="mt-3 max-w-2xl leading-7 text-gray-600">
            Your company information and projects will be used to create a
            professional profile.
          </p>
          {!profile && !profileStructure && (
            <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4">
              <p className="font-semibold text-green-900">
                ✓ Company information saved successfully
              </p>
              <p className="mt-1 text-sm text-green-800">
                Your saved company data is ready to be analyzed.
              </p>
            </div>
          )}
{!profile && !profileStructure && (
          <button
  type="button"
  onClick={handleAnalyze}
  disabled={loading}
  className="mt-8 rounded-lg bg-black px-6 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-wait disabled:opacity-60"
>
  {loading ? "Analyzing..." : "Analyze Saved Company"}
</button>
)}
{!profile && profileStructure && (
  <div
    className={`mt-8 rounded-xl border border-gray-200 bg-gray-50 p-5 transition-opacity ${
      loading ? "pointer-events-none opacity-50" : ""
    }`}
  >
    <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
      We’ve tailored your profile structure
    </p>

    <h3 className="mt-2 text-xl font-semibold text-gray-900">
      {profileStructure.companyType}
    </h3>

    <div className="mt-5 space-y-3">
      {profileStructure.recommendedSections.map((section) => {
  const isSelected = selectedSectionIds.includes(section.id);

  return (
    <div
  key={section.id}
  className="rounded-lg border border-gray-200 bg-white p-4 transition hover:border-gray-400"
>
  <div className="flex gap-3">
    <input
      type="checkbox"
      aria-label={`Include ${section.displayTitle}`}
      checked={isSelected}
      disabled={loading}
      onChange={() => {
        setSelectedSectionIds((current) => {
          const next = current.includes(section.id)
            ? current.filter((id) => id !== section.id)
            : [...current, section.id];
          persistStructureSnapshot(profileStructure, next);
          return next;
        });
        setStructureConfirmed(false);
      }}
      className="mt-1 h-4 w-4"
    />

    <div className="min-w-0 flex-1">
      {editingSectionId === section.id ? (
        <div>
          <input
            type="text"
            aria-label={`${section.displayTitle} title`}
            aria-describedby={errorMessage ? "structure-error" : undefined}
            value={editingSectionTitle}
            disabled={loading}
            onChange={(event) =>
              setEditingSectionTitle(event.target.value)
            }
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-black"
            autoFocus
          />
          <textarea
            value={editingSectionDescription}
            disabled={loading}
            onChange={(event) => setEditingSectionDescription(event.target.value)}
            rows={3}
            aria-label={`${section.displayTitle} description`}
            className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-black"
          />

          {structuredSectionContract(section) && (
            <div className="mt-3 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Structured items ({section.items?.length ?? 0}/{structuredSectionContract(section)!.max})</p>
              {(section.items ?? []).map((item, itemIndex) => (
                <div key={item.id} className="rounded-md border border-gray-200 bg-white p-3">
                  <p className="text-sm font-medium text-gray-900">{item.title}</p>
                  <p className="mt-1 text-xs leading-5 text-gray-600">{item.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => {
                      const title = window.prompt("Service title:", item.title); if (title === null) return;
                      const description = window.prompt("Service description:", item.description); if (description === null) return;
                      applyStructureEdit(editApprovedStructuredItem(profileStructure as EditableProfileStructure, section.id, item.id, { title, description }));
                    }} aria-label={`Edit ${item.title}`} className="rounded border border-gray-300 px-2 py-1 text-xs">Edit item</button>
                    <button type="button" aria-label={`Move ${item.title} up`} disabled={itemIndex === 0} onClick={() => commitStructure((current) => moveApprovedServiceItem(current, section.id, item.id, -1) as ProfileStructure)} className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40">Move up</button>
                    <button type="button" aria-label={`Move ${item.title} down`} disabled={itemIndex === (section.items?.length ?? 0) - 1} onClick={() => commitStructure((current) => moveApprovedServiceItem(current, section.id, item.id, 1) as ProfileStructure)} className="rounded border border-gray-300 px-2 py-1 text-xs disabled:opacity-40">Move down</button>
                    <button type="button" aria-label={`Delete ${item.title}`} onClick={() => { commitStructure((current) => deleteApprovedServiceItem(current, section.id, item.id) as ProfileStructure); window.setTimeout(() => document.getElementById(`add-item-${section.id}`)?.focus(), 0); }} className="rounded border border-red-200 px-2 py-1 text-xs text-red-700">Delete item</button>
                  </div>
                </div>
              ))}
              <button id={`add-item-${section.id}`} type="button" aria-label={`Add item to ${section.displayTitle}`} disabled={(section.items?.length ?? 0) >= structuredSectionContract(section)!.max} onClick={() => {
                const contract = structuredSectionContract(section)!; if ((section.items?.length ?? 0) >= contract.max) { setErrorMessage(`This section supports at most ${contract.max} items.`); return; }
                const title = window.prompt("New item title:"); if (!title) return;
                const description = window.prompt("New item description/instruction:"); if (!description) return;
                applyStructureEdit(addApprovedStructuredItem(profileStructure as EditableProfileStructure, section.id, { title, description }));
              }} className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium disabled:opacity-40">+ Add structured item</button>
            </div>
          )}

          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                const result = editApprovedSection(profileStructure as EditableProfileStructure, section.id, { displayTitle: editingSectionTitle, description: editingSectionDescription });
                if (!result.valid) { setErrorMessage(result.error); return; }
                applyStructureEdit(result);

                setEditingSectionId(null);
                setEditingSectionTitle("");
                setEditingSectionDescription("");
              }}
              className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white"
            >
              Save
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => {
                setEditingSectionId(null);
                setEditingSectionTitle("");
                setEditingSectionDescription("");
              }}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-900"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-medium text-gray-900">
              {section.displayTitle}
            </p>

            <p className="mt-1 text-sm leading-6 text-gray-600">
              {section.description}
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setEditingSectionId(section.id);
              setEditingSectionTitle(section.displayTitle);
              setEditingSectionDescription(section.description);
              setStructureConfirmed(false);
            }}
            className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-900 hover:border-gray-900"
          >
            Edit {section.displayTitle}
          </button>
        </div>
      )}
    </div>
  </div>
</div>
  );
})}
<div className="mt-5 flex flex-wrap items-center justify-between gap-3">
  <button
    type="button"
    disabled={loading}
    onClick={() => {
      const title = window.prompt("Enter the new section name:");

      if (!title?.trim()) {
        return;
      }

      const newSection: ProfileSection = {
        id: createStableCustomSectionId(
          title.trim(),
          profileStructure.recommendedSections.map((section) => section.id),
        ),
        displayTitle: title.trim(),
        description: "Custom section added by you.",
      };

      const nextIds = [...selectedSectionIds, newSection.id];
      const nextStructure = { ...profileStructure, recommendedSections: [...profileStructure.recommendedSections, newSection] };
      setProfileStructure(nextStructure);
      setSelectedSectionIds(nextIds);
      persistStructureSnapshot(nextStructure, nextIds);

      setStructureConfirmed(false);
    }}
    className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-900 transition hover:border-gray-900 hover:bg-gray-50"
  >
    + Add Another Section
  </button>

  <button
    type="button"
    disabled={loading}
    onClick={() => {
      setErrorMessage("");
      setStructureConfirmed(true);
    }}
    className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
  >
    {structureConfirmed
      ? "✓ Structure Confirmed"
      : "✓ This Looks Good"}
  </button>

  {structureConfirmed && (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={loading}
      className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-wait disabled:opacity-60"
    >
      {loading && (
        <span
          aria-hidden="true"
          className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent align-[-2px]"
        />
      )}
      {loading ? "Generating..." : "Generate Profile"}
    </button>
  )}
</div>

    </div>
  </div>
)}
          {errorMessage && (
            <p id="structure-error" role="alert" aria-live="assertive" className="mt-6 text-sm text-red-600">{errorMessage}</p>
          )}

          {profile && (
            <div className="mt-10 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-inner">
              <div className="flex flex-col gap-5 border-b border-gray-200 bg-white px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-7">
                <div>
                  <div className="flex items-center gap-4">
                    {profile.logoUrl && (
                      <img
                        src={profile.logoUrl}
                        alt={`${profile.companyName} logo`}
                        className="h-12 w-20 rounded-lg border border-gray-200 bg-white object-contain p-1"
                      />
                    )}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                        Company Profile
                      </p>
                      <h3 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
                        {profile.companyName}
                      </h3>
                    </div>
                  </div>
                  <div className="mt-3 h-1 w-14 rounded-full bg-gray-900" />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:border-gray-900 hover:bg-gray-50"
                  >
                    {copyMessage ? "Copied!" : "Copy Profile"}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    disabled={isExporting}
                    className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isExporting ? "Exporting..." : "Download PDF"}
                  </button>
                </div>
              </div>

              <section className="space-y-10 px-5 py-7 text-gray-700 sm:px-7 sm:py-9">
  {profile.sections?.map((section) => (
    <div key={section.id} className="max-w-4xl">
      <h4 className="text-xl font-semibold tracking-tight text-gray-900">
        {section.title}
      </h4>

      <div className="mt-3 h-px w-12 bg-gray-900" />

      {section.content && (
        <p className="mt-4 text-base leading-8">
          {section.content}
        </p>
      )}

      {section.items?.length > 0 && (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {section.items.map((item, index) => (
            <article
              key={`${item.name}-${index}`}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-64 w-full bg-gray-100 object-contain object-center"
                />
              )}

              <div className="p-5">
                <h5 className="font-semibold text-gray-900">
                  {item.name}
                </h5>

                {item.description && (
                  <p className="mt-3 text-sm leading-7">
                    {item.description}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  ))}
</section>

{copyMessage && (
  <p className="px-5 py-3 text-sm text-green-600">
    {copyMessage}
  </p>
)}              {exportMessage && <p role={exportMessageTone === "error" ? "alert" : "status"} className={`px-5 pt-3 text-sm sm:px-7 ${exportMessageTone === "error" ? "text-red-600" : exportMessageTone === "success" ? "text-green-600" : "text-gray-600"}`}>{exportMessage}</p>}

              <div className="mt-8 flex flex-col gap-3 border-t border-gray-200 px-5 pb-7 pt-6 sm:flex-row sm:flex-wrap sm:px-7">
                <Link href="/company" className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800">
                  Edit Company Data
                </Link>
                <Link href="/projects" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:border-gray-900 hover:bg-gray-50">
                  Edit Projects
                </Link>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={loading}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:border-gray-900 hover:bg-gray-50 disabled:cursor-wait disabled:opacity-60"
                >
                  {loading && (
                    <span
                      aria-hidden="true"
                      className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-900 border-t-transparent align-[-2px]"
                    />
                  )}
                  {loading ? "Regenerating..." : "Regenerate Profile"}
                </button>
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={isExporting}
                  aria-label="Download company profile PDF"
                  className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-wait disabled:opacity-60"
                >
                  {isExporting ? "Exporting..." : "Download PDF"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
