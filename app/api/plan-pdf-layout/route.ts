import OpenAI from "openai";
import {
  createLegacyFallbackLayoutPlan,
  resolvePageCompositionPlanForLegacyRenderer,
  sanitizeContextualVisuals,
  type PlannerSectionMetadata,
} from "@/lib/visual-system/page-composition-planner";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const limitText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.slice(0, maxLength) : "";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const company = body?.company;
    const profile = body?.profile;
    const projects = Array.isArray(body?.projects) ? body.projects : [];

    if (
      !company?.name ||
      !profile?.companyName ||
      !Array.isArray(profile?.sections)
    ) {
      return Response.json(
        { error: "Company, generated profile, and profile sections are required." },
        { status: 400 }
      );
    }

    const sections: PlannerSectionMetadata[] = profile.sections
      .slice(0, 30)
      .map((section: Record<string, unknown>) => ({
        id: limitText(section.id, 100),
        itemNames: Array.isArray(section.items)
          ? section.items
              .slice(0, 20)
              .map((item: Record<string, unknown>) => limitText(item.name, 200))
              .filter(Boolean)
          : [],
      }));
    const fallbackPlan = createLegacyFallbackLayoutPlan(sections);
    const contextualVisuals = sanitizeContextualVisuals(
      body?.contextualVisuals
    );
    const availableContextualVisuals = contextualVisuals.filter(
      (visual) => visual.status === "selected"
    );
    const projectNames = projects
      .slice(0, 20)
      .map((project: Record<string, unknown>) => limitText(project.name, 200))
      .filter(Boolean);

    const planningInput = {
      company: {
        name: limitText(company.name, 200),
        logoAvailable: Boolean(company.logoUrl),
      },
      profile: {
        companyName: limitText(profile.companyName, 200),
        companyType: limitText(profile.companyType, 200),
        sections: profile.sections
          .slice(0, 30)
          .map((section: Record<string, unknown>) => ({
            id: limitText(section.id, 100),
            title: limitText(section.title, 200),
            contentLength:
              typeof section.content === "string" ? section.content.length : 0,
            itemNames: Array.isArray(section.items)
              ? section.items
                  .slice(0, 20)
                  .map((item: Record<string, unknown>) =>
                    limitText(item.name, 200)
                  )
                  .filter(Boolean)
              : [],
          })),
      },
      projects: projects
        .slice(0, 20)
        .map((project: Record<string, unknown>) => ({
          name: limitText(project.name, 200),
          descriptionLength:
            typeof project.description === "string"
              ? project.description.length
              : 0,
          imageAvailable: Boolean(project.imageUrl),
        })),
      contextualVisuals: availableContextualVisuals,
    };

    const prompt = `
You are a premium corporate brochure page-composition planner.

Create a semantic PageCompositionPlan for a deterministic A4 PDF renderer.
You may decide only page roles, page grouping, section ordering, supported archetypes, density, lead/body hierarchy, project grid versus project feature treatment, assignment of known contextual brief IDs to allowed visual slots, and hierarchy emphasis.

The renderer handles all coordinates, measurements, page breaks, overflow, margins, typography, colors, image cropping, and drawing.

AVAILABLE DATA:
${JSON.stringify(planningInput, null, 2)}

Return ONLY valid JSON in exactly this shape:
{
  "version": 2,
  "pages": [
    {
      "id": "page-id",
      "pageRole": "cover",
      "archetype": "cover_editorial",
      "density": "minimal",
      "sections": [
        { "sectionId": "known-section-id", "treatment": "lead" }
      ],
      "visualAssignments": [
        {
          "role": "contextual_stock",
          "briefId": "known-selected-brief-id",
          "slot": "hero"
        }
      ],
      "hierarchy": {
        "primarySectionId": "known-section-id",
        "emphasis": "visual"
      }
    }
  ]
}

CLOSED VOCABULARY:
- pageRole: "cover", "introduction", "narrative", "projects"
- archetype: "cover_editorial", "narrative_split", "narrative_stack", "project_grid", "project_feature"
- density: "minimal", "balanced", "rich"
- section treatment: "lead", "body", "project_grid", "project_feature"
- visual slot: "hero", "side_media", "top_media"
- hierarchy emphasis: "visual", "content", "balanced"

STRICT RULES:
1. Use every supplied section ID exactly once. Never invent or duplicate a section ID.
2. Use only supplied project names. Project treatments must include projectNames.
3. Use only selected contextual brief IDs listed in contextualVisuals.
4. Every visual assignment role must be exactly "contextual_stock".
5. Contextual stock is editorial imagery only. It must never represent completed company work.
6. Never assign contextual stock to a project_grid or project_feature page or treatment.
7. Authentic project imagery is separate and is handled only by the deterministic renderer.
8. Do not invent coordinates, layouts outside the archetype list, fonts, font sizes, colors, image URLs, page numbers, content, sections, projects, or brief IDs.
9. A cover page may have no sections. Omit primarySectionId when a page has no sections.
10. Do not return markdown or explanations.
`;

    try {
      const response = await client.responses.create({
        model: "gpt-5.6",
        input: prompt,
      });
      const output = response.output_text?.trim();

      if (!output) {
        return Response.json(fallbackPlan);
      }

      let parsedPlan: unknown;
      try {
        parsedPlan = JSON.parse(
          output
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
        );
      } catch {
        return Response.json(fallbackPlan);
      }

      const resolved = resolvePageCompositionPlanForLegacyRenderer(
        parsedPlan,
        {
          sectionIds: sections.map((section) => section.id),
          contextualVisuals: availableContextualVisuals,
          projectNames,
        },
        sections
      );

      if (resolved.usedFallback && resolved.semanticIssues.length > 0) {
        console.error("Page composition semantic validation failed", { issueCodes: resolved.semanticIssues.map((issue) => issue.code) });
      }

      return Response.json(resolved.layoutPlan);
    } catch (error) {
      console.error("PDF page composition planner failed", { name: error instanceof Error ? error.name : "UnknownError" });
      return Response.json(fallbackPlan);
    }
  } catch (error) {
    console.error("PDF layout planner request failed", { name: error instanceof Error ? error.name : "UnknownError" });
    return Response.json(
      { error: "Failed to plan PDF layout." },
      { status: 500 }
    );
  }
}
