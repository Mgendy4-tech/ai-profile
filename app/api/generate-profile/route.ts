import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();



    const { company, projects, selectedSections } = body;

if (!company?.name || !company?.about) {
  return Response.json(
    { error: "Company name and about are required." },
    { status: 400 }
  );
}

const sections = Array.isArray(selectedSections)
  ? selectedSections
  : [];

const prompt = `
Analyze the company information below and create professional company profile content based ONLY on the approved profile structure.

Company:
${JSON.stringify(company, null, 2)}

Projects:
${JSON.stringify(
  (projects || []).map((project: any) => ({
    name: project.name,
    description: project.description?.slice(0, 500),
  })),
  null,
  2
)}

Approved Profile Structure:
${JSON.stringify(sections, null, 2)}

IMPORTANT RULES:

1. Generate content ONLY for the approved sections listed above.

2. Do NOT create any additional sections.

3. Do NOT invent facts, clients, partners, projects, locations, certifications, awards, numbers, services, or business claims.

4. Use ONLY information explicitly provided in the company data and project data.

5. Section titles must use the approved displayTitle exactly.

6. Only recommend or generate a Projects section when actual project data is provided.

7. If the Projects array is empty, do NOT create a Projects section.

8. Keep project names unchanged.

9. Keep project descriptions faithful to the provided project information.

10. Avoid unnecessary repetition between sections.

11. Write clear, professional B2B company-profile English.

12. The profile should feel specifically written for this company, not like a generic template.

Return ONLY valid JSON.

Return exactly this structure:

{
  "companyType": "string",
  "sections": [
    {
      "id": "section id from approved structure",
      "title": "approved displayTitle",
      "description": "approved section description",
      "content": "Professional content for this section",
      "items": []
    }
  ]
}

For sections that contain multiple items, such as projects, use:

"items": [
  {
    "name": "Item name",
    "description": "Item description"
  }
]

For normal text sections, use:

"items": []

Do not return markdown.
Do not return explanations outside the JSON.
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

    let profile;

    try {
      profile = JSON.parse(output);
    } catch {
      return Response.json(
        {
          error: "The AI response was not valid JSON.",
          raw: output,
        },
        { status: 500 }
      );
    }

    return Response.json(profile);
  } catch (error) {
    console.error("Generate profile error:", error);

    return Response.json(
      { error: "Failed to generate company profile." },
      { status: 500 }
    );
  }
}