import OpenAI from "openai";
import { NextResponse } from "next/server";
import type {
  BrandAnalysis,
  VisualDirection,
} from "@/lib/visual-system/types";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type VisualDirectionRequest = {
  company: {
    name?: string;
    about?: string;
    activities?: string;
    yearsOfExperience?: string | number;
  };
  brandAnalysis: BrandAnalysis;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as VisualDirectionRequest;

    if (!body.company?.name?.trim()) {
      return NextResponse.json(
        { error: "Company name is required." },
        { status: 400 }
      );
    }

    const prompt = `
You are the Visual Director layer of an AI company-profile design system.

Your job is to create a restrained, professional visual direction for a PDF company profile.

Return ONLY valid JSON.

COMPANY:
${JSON.stringify(body.company, null, 2)}

BRAND ANALYSIS:
${JSON.stringify(body.brandAnalysis, null, 2)}

STRICT RULES:

1. Do not invent project photography.
2. User-uploaded project photos are handled separately.
3. Contextual imagery must never look like completed company work.
4. Produce between 3 and 5 image briefs.
5. Keep the PDF visually professional and editorial, not decorative.
6. Avoid excessive visual elements.
7. animationAllowed must always be false.
8. density must be exactly one of:
   "minimal", "balanced", "rich".
9. purpose must be exactly one of:
   "hero", "contextual", "supporting".
10. placement must be exactly one of:
   "full_bleed", "column", "side".
11. aspectRatio must be exactly one of:
   "16:9", "4:3", "1:1".
12. elementCount limits:
   geometricShapes: 0-3
   patterns: 0-1
   images: 3-5
   typographyStyles: 1-3
   accentElements: 0-2

For an interior design company, prioritize:
- architectural/interior context
- material details
- design process
- spatial atmosphere
- premium finishes

Do not create generic business-handshake imagery unless strongly justified.

Return exactly this structure:

{
  "concept": "string",
  "density": "minimal",
  "imageBriefs": [
    {
      "id": "cover_hero",
      "purpose": "hero",
      "subject": "string",
      "placement": "full_bleed",
      "aspectRatio": "16:9",
      "moodKeywords": ["string"]
    }
  ],
  "elementCount": {
    "geometricShapes": 1,
    "patterns": 0,
    "images": 3,
    "typographyStyles": 2,
    "accentElements": 1
  },
  "animationAllowed": false
}
`;

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input: prompt,
    });

    const raw = response.output_text.trim();

    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/i, "");

    const direction = JSON.parse(cleaned) as VisualDirection;

    const allowedDensity = ["minimal", "balanced", "rich"];
    const allowedPurpose = ["hero", "contextual", "supporting"];
    const allowedPlacement = ["full_bleed", "column", "side"];
    const allowedAspectRatio = ["16:9", "4:3", "1:1"];

    if (
      !allowedDensity.includes(direction.density) ||
      !Array.isArray(direction.imageBriefs) ||
      direction.imageBriefs.length < 3 ||
      direction.imageBriefs.length > 5 ||
      direction.imageBriefs.some(
        (brief) =>
          !allowedPurpose.includes(brief.purpose) ||
          !allowedPlacement.includes(brief.placement) ||
          !allowedAspectRatio.includes(brief.aspectRatio)
      ) ||
      direction.elementCount.geometricShapes < 0 ||
      direction.elementCount.geometricShapes > 3 ||
      direction.elementCount.patterns < 0 ||
      direction.elementCount.patterns > 1 ||
      direction.elementCount.images < 3 ||
      direction.elementCount.images > 5 ||
      direction.elementCount.typographyStyles < 1 ||
      direction.elementCount.typographyStyles > 3 ||
      direction.elementCount.accentElements < 0 ||
      direction.elementCount.accentElements > 2 ||
      direction.animationAllowed !== false
    ) {
      throw new Error("Invalid VisualDirection response.");
    }

    return NextResponse.json(direction);
  } catch (error) {
    console.error("Visual direction failed", { name: error instanceof Error ? error.name : "UnknownError" });

    return NextResponse.json(
      { error: "Failed to create visual direction." },
      { status: 500 }
    );
  }
}
