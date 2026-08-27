import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { BrandAnalysis } from "@/lib/visual-system/types";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type AnalyzeBrandRequest = {
  company: {
    name?: string;
    about?: string;
    activities?: string;
    yearsOfExperience?: string | number;
  };
  logoColors?: string[];
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as AnalyzeBrandRequest;

    if (!body.company?.name?.trim()) {
      return NextResponse.json(
        { error: "Company name is required." },
        { status: 400 }
      );
    }

    const logoColors = body.logoColors ?? [];

    const prompt = `
You are the Brand Analysis layer of an AI company-profile design system.

Analyze the company and return ONLY valid JSON.

COMPANY:
${JSON.stringify(body.company, null, 2)}

DETERMINISTIC LOGO COLORS:
${JSON.stringify(logoColors)}

RULES:

1. Logo colors are factual brand signals. Never invent replacement logo colors.

2. colorStrategy must be:
   - "respect_logo" when the supplied colors provide a usable brand palette.
   - "expand_palette" when the supplied colors need complementary colors.
   - "expand_palette" when no useful logo colors are available.

3. interpretedMood must be exactly:
   "warm", "cool", or "neutral".

4. designStyle must be exactly:
   "minimal", "corporate", or "creative".

5. energyLevel must be an integer from 1 to 10.

6. confidence must be a number from 0 to 1.

7. Do not generate layouts, images, typography, or PDF instructions.
   This stage performs brand analysis only.

Return exactly this structure:

{
  "logoColors": ["#HEX"],
  "colorStrategy": "respect_logo",
  "interpretedMood": "neutral",
  "designStyle": "corporate",
  "energyLevel": 5,
  "confidence": 0.9
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

    const analysis = JSON.parse(cleaned) as BrandAnalysis;

    const allowedStrategies = ["respect_logo", "expand_palette"];
    const allowedMoods = ["warm", "cool", "neutral"];
    const allowedStyles = ["minimal", "corporate", "creative"];

    if (
      !allowedStrategies.includes(analysis.colorStrategy) ||
      !allowedMoods.includes(analysis.interpretedMood) ||
      !allowedStyles.includes(analysis.designStyle) ||
      !Number.isInteger(analysis.energyLevel) ||
      analysis.energyLevel < 1 ||
      analysis.energyLevel > 10 ||
      typeof analysis.confidence !== "number" ||
      analysis.confidence < 0 ||
      analysis.confidence > 1
    ) {
      throw new Error("Invalid BrandAnalysis response.");
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error("Brand analysis failed", { name: error instanceof Error ? error.name : "UnknownError" });

    return NextResponse.json(
      { error: "Failed to analyze brand." },
      { status: 500 }
    );
  }
}
