import OpenAI from "openai";
import { analyzedStructureErrorMessage, validateAnalyzedProfileStructure } from "@/lib/profile-structure-boundary";
import { validateGenerationRequestSize } from "@/lib/production-limits";
import { emitProductionTelemetry } from "@/lib/production-telemetry";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const body = await request.json();
    const requestLimit = validateGenerationRequestSize(body);
    if (requestLimit) return Response.json({ error: requestLimit.message, code: requestLimit.code, retryable: false }, { status: 413 });

    const { company, projects } = body;

    if (!company?.name || !company?.about) {
      return Response.json(
        { error: "Company name and about are required." },
        { status: 400 }
      );
    }

    const prompt = `
You are a B2B company profile structure analyst.

Analyze the company information below and determine the most appropriate structure for its professional company profile.

Company information:
${JSON.stringify(company, null, 2)}

Project data:
${JSON.stringify(projects || [], null, 2)}

Return ONLY valid JSON in exactly this structure:

{
  "companyType": "string",
  "recommendedSections": [
    {
      "id": "string",
      "displayTitle": "string",
      "description": "string"
    }
  ]
}

Rules:

1. Return ONLY JSON. No markdown. No explanation outside the JSON.
2. Recommend between 4 and 8 sections.
3. The structure must be customized to the company's actual business model and industry.
4. Do NOT force a "Projects" section.
5. If the company is project-based, "Projects" or "Featured Projects" may be appropriate.
6. If the company is partnership/network/platform-based, use sections such as Partnerships, Network, Solutions, Initiatives, or How It Works when supported by the provided information.
7. Do NOT invent business activities, services, partnerships, clients, achievements, numbers, or facts.
8. Use only information explicitly provided by the company.
9. Do not generate section content. Only describe what each section should contain.
10. Keep section IDs simple and reusable, for example:
   "about"
   "mainActivities"
   "expertise"
   "services"
   "projects"
   "partnerships"
   "network"
   "solutions"
   "initiatives"
   "howItWorks"
   "industries"
   "whyChoose"
11. Section titles should sound natural for this specific company.
12. Avoid unnecessary sections.
13. The goal is to create a profile structure that feels written specifically for this company, not a generic template.
14. Only recommend a Projects section if actual project data is provided.
15. If the Project data array is empty, do NOT recommend a Projects section.
16. Do not assume that a company has projects, partnerships, clients, case studies, or other business assets simply because they are common in its industry.
17. The available company data and project data must determine which sections are appropriate.
18. For consulting, advisory, agency, or professional-services companies without projects, use only these supported semantic section IDs: "about", "services", "expertise", "howItWorks", and "solutions". Always include "about" and "services"; include the other supported IDs only when the supplied company information supports them. Do not recommend unsupported marketing sections merely to reach a target count.
19. For SaaS, software, platform, AI, technology, or digital-product companies without projects, use only these Product / Tech authored IDs: "about", "features", and "useCases". Always include "about" and "features"; include "useCases" only when explicitly supported. Do not relabel product capabilities as services and do not recommend unsupported sections.
20. For Product / Tech structures, keep each section description/instruction concise: at most 8 ordinary words for "about" and at most 18 ordinary words for "features" or "useCases". Avoid long unbroken words.
`;

    const response = await client.responses.create({
      model: "gpt-5.6",
      input: prompt,
    });

    const output = response.output_text?.trim();

    if (!output) {
      return Response.json(
        { error: "The AI returned an empty response." },
        { status: 500 }
      );
    }

    let analysis;

    try {
      analysis = JSON.parse(output);
    } catch {
      return Response.json(
        {
          error: "The AI response was not valid JSON.",
          code: "analyzed_profile_json_invalid",
          retryable: true,
        },
        { status: 500 }
      );
    }

    const validated = validateAnalyzedProfileStructure(analysis);
    if (!validated.valid) { emitProductionTelemetry({ name: "structure_analysis_rejected", failureClass: "model_contract_rejection", reasonCode: validated.diagnostics[0]?.code ?? "analyzed_profile_structure_invalid", latencyMs: Date.now() - startedAt }); return Response.json({ error: analyzedStructureErrorMessage, code: "analyzed_profile_structure_invalid", retryable: true, ...(process.env.NODE_ENV !== "production" ? { diagnostics: validated.diagnostics } : {}) }, { status: 502 }); }
    return Response.json(validated.structure);
  } catch (error) {
    emitProductionTelemetry({ name: "external_api_failed", failureClass: "external_api_failure", provider: "openai", operation: "analyze_structure", reasonCode: error instanceof OpenAI.APIError ? `openai_${error.status}` : "runtime_system_failure" });
    console.error("Analyze structure failed", { name: error instanceof Error ? error.name : "UnknownError" });

    return Response.json(
      { error: "Failed to analyze company structure." },
      { status: 500 }
    );
  }
}
