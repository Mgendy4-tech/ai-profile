import jsPDF from "jspdf";
import { resolvePageComposition, type ResolvedArea } from "./composition-resolver";
import { createPDFDesignTokens } from "./pdf-design-tokens";
import {
  drawProjectPage,
  getProjectPageActivation,
  prepareProjectPage,
  type ProjectPortfolioItem,
} from "./pdf-project-composition";
import type { PageCompositionPlan } from "./types";

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

const resolveProjectPage = (
  archetype: "project_grid" | "project_feature",
  names: string[]
) => {
  const plan: PageCompositionPlan = {
    version: 2,
    pages: [{
      id: archetype,
      pageRole: "projects",
      archetype,
      density: "balanced",
      sections: [{
        sectionId: "projects",
        treatment: archetype,
        projectNames: names,
      }],
      visualAssignments: [],
      hierarchy: { primarySectionId: "projects", emphasis: "visual" },
    }],
  };
  return resolvePageComposition(plan, {
    sectionIds: ["projects"],
    projectNames: names,
    contextualVisuals: [],
  });
};

const gridResolution = resolveProjectPage("project_grid", ["Villa", "Penthouse"]);
assert(gridResolution.ok, "Project grid should resolve.");
if (!gridResolution.ok) throw new Error("Expected project grid resolution.");
const gridActivation = getProjectPageActivation(gridResolution.composition.pages[0]);
assert(
  gridActivation?.treatment === "project_grid",
  "Resolved project_grid should activate the portfolio engine."
);

const projects: ProjectPortfolioItem[] = [
  {
    name: "Villa",
    description: "A complete residential interior with natural materials.",
    image: {
      role: "project_image",
      provenance: "user_upload",
      source: "authentic-villa-image",
      width: 1800,
      height: 1200,
    },
  },
  {
    name: "Penthouse",
    description: "A refined city residence with a restrained palette.",
    image: {
      role: "project_image",
      provenance: "user_upload",
      source: "authentic-penthouse-image",
      width: 1600,
      height: 1200,
    },
  },
];
const tokens = createPDFDesignTokens(null);
const gridPdf = new jsPDF({ unit: "mm", format: "a4" });
const preparedGrid = prepareProjectPage(
  gridPdf,
  gridActivation!,
  projects,
  tokens,
  3,
  "dark"
);
const repeatedGrid = prepareProjectPage(
  new jsPDF({ unit: "mm", format: "a4" }),
  gridActivation!,
  projects,
  tokens,
  3,
  "dark"
);
assert(
  preparedGrid?.variant === "asymmetric_two_project" &&
    preparedGrid.projects[0].dominant &&
    !preparedGrid.projects[1].dominant &&
    preparedGrid.projects[0].imageArea!.width >
      preparedGrid.projects[1].imageArea!.width,
  "Two-project grids must use an asymmetric dominant hierarchy."
);
assert(
  preparedGrid!.projects[1].captionWidth >=
    preparedGrid!.contentArea.width * 0.35 &&
    preparedGrid!.projects[1].imageArea!.x === preparedGrid!.projects[1].titleX,
  "The secondary project column must be readable and share a clean image/text alignment."
);
assert(
  JSON.stringify(preparedGrid) === JSON.stringify(repeatedGrid),
  "Identical project inputs must resolve identically."
);
assert(
  preparedGrid?.usesContextualStock === false &&
    preparedGrid.usesRoundedCards === false &&
    preparedGrid.projects.every(
      (project) =>
        project.image?.role === "project_image" &&
        project.image.provenance === "user_upload"
    ),
  "Project pages must use authentic images without UI-card styling."
);
assert(
  preparedGrid?.artDirection.compositionFamily === "editorial_portfolio" &&
    preparedGrid.projects[0].imageArea?.x === 0 &&
    preparedGrid.projects[0].imageArea?.y === 0,
  "Editorial Portfolio should give the dominant authentic image edge-bleed ownership."
);
preparedGrid?.projects.forEach((project) => {
  assert(
    project.descriptionFontSize >= 9.5 && project.descriptionLineHeight >= 5.2,
    "Project descriptions must remain comfortably readable."
  );
  assert(
    project.headingBounds.bottom < project.ruleY,
    "Project caption rule must clear title glyph bounds."
  );
  if (project.descriptionBounds) {
    assert(
      project.ruleY < project.descriptionBounds.top,
      "Project caption rule must clear description glyph bounds."
    );
  }
  assert(
    project.headingBounds.top >= 0 && project.bottom <= 297,
    "Project text bounds must remain inside the physical A4 page."
  );
  assert(
    !("location" in project) && !("year" in project) && !("scope" in project),
    "Project composition must not invent unavailable metadata."
  );
});

const isWithinA4 = (area: ResolvedArea) =>
  area.x >= 0 &&
  area.y >= 0 &&
  area.width > 0 &&
  area.height > 0 &&
  area.x + area.width <= 210 &&
  area.y + area.height <= 297;
preparedGrid?.projects.forEach((project) => {
  if (project.imageArea) {
    assert(isWithinA4(project.imageArea), "Project media must remain inside A4.");
  }
});
assert(
  preparedGrid?.pageMode === "accent",
  "Project pages must participate in deterministic page pacing."
);

const featureResolution = resolveProjectPage("project_feature", ["Villa"]);
assert(featureResolution.ok, "Project feature should resolve.");
if (!featureResolution.ok) throw new Error("Expected project feature resolution.");
const featureActivation = getProjectPageActivation(
  featureResolution.composition.pages[0]
);
assert(
  featureActivation?.treatment === "project_feature",
  "Resolved single project_feature should activate."
);
const imageFreeFeature = prepareProjectPage(
  new jsPDF({ unit: "mm", format: "a4" }),
  featureActivation!,
  [{ ...projects[0], image: null }],
  tokens,
  2,
  "light"
);
assert(
  imageFreeFeature?.variant === "typographic_feature" &&
    imageFreeFeature.projects[0].imageArea === null,
  "Image-free project feature must be typography-led without an empty frame."
);
const drawResult = drawProjectPage(
  new jsPDF({ unit: "mm", format: "a4" }),
  imageFreeFeature!,
  "Aurelia Interior Studio",
  tokens
);
assert(
  drawResult.consumedSectionIds.join(",") === "projects",
  "Project section should be consumed only after successful drawing."
);

const invalidImage = prepareProjectPage(
  new jsPDF({ unit: "mm", format: "a4" }),
  featureActivation!,
  [{
    ...projects[0],
    image: {
      ...projects[0].image!,
      provenance: "pexels",
    } as unknown as ProjectPortfolioItem["image"],
  }],
  tokens,
  2,
  "light"
);
assert(
  invalidImage === null,
  "Contextual or invalid provenance must not be considered as project imagery."
);
assert(
  prepareProjectPage(
    new jsPDF({ unit: "mm", format: "a4" }),
    gridActivation!,
    [projects[0]],
    tokens,
    2,
    "light"
  ) === null,
  "Missing planned projects must fail preflight without consuming content."
);

let drawFailed = false;
try {
  drawProjectPage(
    new jsPDF({ unit: "mm", format: "a4" }),
    imageFreeFeature!,
    " ",
    tokens
  );
} catch {
  drawFailed = true;
}
assert(drawFailed, "Unsafe project drawing must signal legacy fallback.");

const contextualMutation = structuredClone(gridResolution.composition.pages[0]);
contextualMutation.visualAssignments.push({
  role: "contextual_stock",
  briefId: "forbidden",
  slot: "hero",
  area: { x: 0, y: 0, width: 1, height: 1 },
  fallbackArea: { x: 0, y: 0, width: 1, height: 1 },
  state: "missing",
  visual: null,
  fallbackReason: "Forbidden",
});
assert(
  getProjectPageActivation(contextualMutation) === null,
  "Contextual assignments must disable v2 project activation."
);

console.log("PDF project composition tests passed.");
