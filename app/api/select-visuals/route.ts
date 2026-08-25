import { NextResponse } from "next/server";
import { selectVisualImage } from "@/lib/visual-system/select-visual-image";
import type {
  SelectedContextualVisual,
  SelectVisualsResponse,
  VisualDirection,
} from "@/lib/visual-system/types";

type ImageBrief = VisualDirection["imageBriefs"][number];

type SelectVisualsRequest = {
  visualDirection?: VisualDirection;
  imageBriefs?: ImageBrief[];
};

const isImageBrief = (value: unknown): value is ImageBrief => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const brief = value as Partial<ImageBrief>;

  return (
    typeof brief.id === "string" &&
    typeof brief.subject === "string" &&
    ["hero", "contextual", "supporting"].includes(brief.purpose ?? "") &&
    ["full_bleed", "column", "side"].includes(brief.placement ?? "") &&
    ["16:9", "4:3", "1:1"].includes(brief.aspectRatio ?? "") &&
    Array.isArray(brief.moodKeywords) &&
    brief.moodKeywords.every((keyword) => typeof keyword === "string")
  );
};

const createFallbackVisual = (
  brief: ImageBrief,
  fallbackReason: string
): SelectedContextualVisual => ({
  role: "contextual_stock",
  provenance: "pexels",
  briefId: brief.id,
  purpose: brief.purpose,
  placement: brief.placement,
  aspectRatio: brief.aspectRatio,
  status: "fallback",
  source: null,
  photographer: null,
  imageUrl: null,
  width: null,
  height: null,
  overallScore: null,
  fallbackReason,
});

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SelectVisualsRequest;
    const imageBriefs = body.visualDirection?.imageBriefs ?? body.imageBriefs;

    if (
      !Array.isArray(imageBriefs) ||
      imageBriefs.length === 0 ||
      imageBriefs.length > 5 ||
      !imageBriefs.every(isImageBrief)
    ) {
      return NextResponse.json(
        { error: "A valid Visual Direction or image briefs are required." },
        { status: 400 }
      );
    }

    const visuals: SelectedContextualVisual[] = [];

    // Keep selection sequential so Pexels and Vision requests remain bounded.
    for (const brief of imageBriefs) {
      try {
        const result = await selectVisualImage(brief);
        const image = result.selectedImage;

        visuals.push({
          role: "contextual_stock",
          provenance: "pexels",
          briefId: brief.id,
          purpose: brief.purpose,
          placement: brief.placement,
          aspectRatio: brief.aspectRatio,
          status: result.status,
          source: image?.source ?? null,
          photographer: image?.photographer ?? null,
          imageUrl: image?.url ?? null,
          width: image?.width ?? null,
          height: image?.height ?? null,
          overallScore: image?.overallScore ?? null,
          fallbackReason: result.fallbackReason,
        });
      } catch (error) {
        console.error(`Visual selection failed for brief ${brief.id}:`, error);
        visuals.push(
          createFallbackVisual(brief, "Visual selection failed for this brief.")
        );
      }
    }

    const response: SelectVisualsResponse = { visuals };
    return NextResponse.json(response);
  } catch (error) {
    console.error("Select visuals request failed:", error);
    return NextResponse.json(
      { error: "Failed to select contextual visuals." },
      { status: 500 }
    );
  }
}
