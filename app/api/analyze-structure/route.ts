import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

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
          raw: output,
        },
        { status: 500 }
      );
    }

    return Response.json(analysis);
  } catch (error) {
    console.error("Analyze structure error:", error);

    return Response.json(
      { error: "Failed to analyze company structure." },
      { status: 500 }
    );
  }
}