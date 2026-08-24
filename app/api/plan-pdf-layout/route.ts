import OpenAI from "openai";
import { z } from "zod";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const layoutBlockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("header"),
  }),
  z.object({
    type: z.literal("textSection"),
    sectionId: z.string().min(1).max(100),
  }),
  z.object({
    type: z.literal("fullWidthSection"),
    sectionId: z.string().min(1).max(100),
  }),
  z.object({
    type: z.literal("twoColumnSection"),
    sectionId: z.string().min(1).max(100),
  }),
  z.object({
    type: z.literal("projectGrid"),
    sectionId: z.string().min(1).max(100),
    projectNames: z.array(z.string().min(1).max(200)).min(1).max(20),
  }),
  z.object({
    type: z.literal("projectFeature"),
    sectionId: z.string().min(1).max(100),
    projectNames: z.array(z.string().min(1).max(200)).min(1).max(5),
  }),
]);

const layoutPlanSchema = z.object({
  version: z.literal(1),
  blocks: z.array(layoutBlockSchema).min(1).max(60),
});

type LayoutPlan = z.infer<typeof layoutPlanSchema>;

const limitText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.slice(0, maxLength) : "";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const company = body?.company;
    const profile = body?.profile;
    const projects = Array.isArray(body?.projects) ? body.projects : [];

    if (!company?.name || !profile?.companyName || !Array.isArray(profile?.sections)) {
      return Response.json(
        { error: "Company, generated profile, and profile sections are required." },
        { status: 400 },
      );
    }

    const planningInput = {
      company: {
        name: limitText(company.name, 200),
        logoAvailable: Boolean(company.logoUrl),
      },
      profile: {
        companyName: limitText(profile.companyName, 200),
        companyType: limitText(profile.companyType, 200),
        sections: profile.sections.slice(0, 30).map((section: Record<string, unknown>) => ({
          id: limitText(section.id, 100),
          title: limitText(section.title, 200),
          contentLength: typeof section.content === "string" ? section.content.length : 0,
          itemNames: Array.isArray(section.items)
            ? section.items.slice(0, 20).map((item: Record<string, unknown>) => limitText(item.name, 200))
            : [],
        })),
      },
      projects: projects.slice(0, 20).map((project: Record<string, unknown>) => ({
        name: limitText(project.name, 200),
        descriptionLength: typeof project.description === "string" ? project.description.length : 0,
        imageAvailable: Boolean(project.imageUrl),
      })),
    };

    const prompt = `
You are a premium corporate brochure layout planner.

Create a semantic layout plan for a deterministic A4 PDF renderer.
The renderer will handle all coordinates, measurements, page breaks, margins, image containment, and drawing.
You must only decide semantic grouping, ordering, and block treatment.

Available data:
${JSON.stringify(planningInput, null, 2)}

Return ONLY valid JSON in exactly this shape:
{
  "version": 1,
  "blocks": [
    { "type": "header" },
    { "type": "textSection", "sectionId": "section-id" },
    { "type": "fullWidthSection", "sectionId": "section-id" },
    { "type": "twoColumnSection", "sectionId": "section-id" },
    { "type": "projectGrid", "sectionId": "section-id", "projectNames": ["Project name"] },
    { "type": "projectFeature", "sectionId": "section-id", "projectNames": ["Project name"] }
  ]
}

Rules:
1. Use only section IDs and project names provided in the input.
2. Include each generated section at most once, preserving its content.
3. Use projectGrid for normal multi-project presentation and projectFeature only when a project deserves a larger treatment based on content or image availability.
4. Keep related blocks together in a sensible reading order; do not plan pages or page breaks.
5. For profiles with multiple narrative sections and a project grid, place the project grid after the strongest introductory sections rather than automatically after every narrative section when that creates an unbalanced document.
6. Use at most one header block, and put it first.
7. Do not invent content, coordinates, sizes, colors, fonts, or page numbers.
8. Do not return markdown or explanations.
`;

    const response = await client.responses.create({
      model: "gpt-5.6",
      input: prompt,
    });
    const output = response.output_text?.trim();

    if (!output) {
      return Response.json({ error: "The AI returned an empty layout plan." }, { status: 502 });
    }

    let parsedPlan: unknown;
    try {
      parsedPlan = JSON.parse(output);
    } catch {
      return Response.json({ error: "The AI layout plan was not valid JSON." }, { status: 502 });
    }

    const plan: LayoutPlan = layoutPlanSchema.parse(parsedPlan);
    return Response.json(plan);
  } catch (error) {
    console.error("PDF layout planner error:", error);
    return Response.json({ error: "Failed to plan PDF layout." }, { status: 500 });
  }
}
