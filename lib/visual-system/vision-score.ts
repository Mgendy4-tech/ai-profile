import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type VisionScoreResult = {
  relevance: number;
  composition: number;
  textSafety: number;
  notes: string;
};

type ScoreImageInput = {
  imageUrl: string;
  brief: {
    subject: string;
    purpose: "hero" | "contextual" | "supporting";
    placement: "full_bleed" | "column" | "side";
    aspectRatio: "16:9" | "4:3" | "1:1";
    moodKeywords: string[];
  };
};

const clamp01 = (value: number) =>
  Math.max(0, Math.min(1, value));

export const scoreImageWithVision = async ({
  imageUrl,
  brief,
}: ScoreImageInput): Promise<VisionScoreResult> => {
  const prompt = `
You are evaluating a candidate image for a professional company-profile PDF.

IMAGE BRIEF:
${JSON.stringify(brief, null, 2)}

Score the image from 0 to 1 on:

1. relevance
How closely the image matches the requested subject, purpose, and mood.

2. composition
How strong and professional the image composition is for editorial PDF use.

3. textSafety
How suitable the image is for the requested placement, especially whether there is usable negative space and visual clarity for text or adjacent content.

IMPORTANT:
- Do not judge resolution. Resolution is handled separately by code.
- Do not assume the image represents actual company work.
- Be strict. A visually attractive image can still score poorly if it does not fit the intended layout.
- Return ONLY valid JSON.

Return exactly:

{
  "relevance": 0.0,
  "composition": 0.0,
  "textSafety": 0.0,
  "notes": "short explanation"
}
`;

  const response = await client.responses.create({
    model: "gpt-5-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: prompt,
          },
          {
            type: "input_image",
            image_url: imageUrl,
            detail: "low",
          },
        ],
      },
    ],
  });

  const raw = response.output_text.trim();

  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  const parsed = JSON.parse(cleaned) as VisionScoreResult;

  if (
    typeof parsed.relevance !== "number" ||
    typeof parsed.composition !== "number" ||
    typeof parsed.textSafety !== "number" ||
    typeof parsed.notes !== "string"
  ) {
    throw new Error("Invalid vision score response.");
  }

  return {
    relevance: clamp01(parsed.relevance),
    composition: clamp01(parsed.composition),
    textSafety: clamp01(parsed.textSafety),
    notes: parsed.notes,
  };
};