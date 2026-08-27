import OpenAI from "openai";
import { generatedSectionsErrorMessage, isSelectedServicesSection, structuredSectionContract, validateGeneratedProfileSections } from "@/lib/generated-profile-boundary";
import { isProductTechCompanyType } from "@/lib/authored-templates/section-role-normalization";
import { createProfileGenerationModelPayload, validateGenerationRequestSize } from "@/lib/production-limits";
import { emitProductionTelemetry } from "@/lib/production-telemetry";
import { approvedSectionManifest, semanticCoverageContract } from "@/lib/generated-profile-prompt-contract";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const body = await request.json();

    const modelPayload = createProfileGenerationModelPayload(body);
    const requestLimit = validateGenerationRequestSize(modelPayload);
    if (requestLimit) return Response.json({ error: requestLimit.message, code: requestLimit.code, retryable: false }, { status: 413 });



    const { company, projects, selectedSections } = modelPayload;

if (!company?.name || !company?.about) {
  return Response.json(
    { error: "Company name and about are required." },
    { status: 400 }
  );
}

const sections = Array.isArray(selectedSections)
  ? selectedSections
  : [];
const serviceSections = sections.filter(isSelectedServicesSection);
const productSections = sections.filter((section: { id: string; displayTitle: string; description: string }) => { const contract = structuredSectionContract(section); return contract && contract.kind !== "service"; });
const serviceSourceMaterial = [company.about, company.companyType, company.industry, company.customerType, company.servicesProducts, company.activities, company.experience]
  .filter((value): value is string => typeof value === "string" && Boolean(value.trim()));
const serviceContract = serviceSections.length === 0 ? "" : `

STRUCTURED SERVICES CONTRACT:

- The approved service section IDs are: ${serviceSections.map((section: { id: string }) => JSON.stringify(section.id)).join(", ")}.
- Each service section must contain between 1 and 12 items. Never truncate a supplied service list.
- Every service item must have exactly these content fields: "id", "name", "description", and "sourceEvidence".
- Use deterministic IDs in returned order: "<section id>:service:1", "<section id>:service:2", and so on.
- "name" is the concise service title.
- Keep each service "name" to at most 28 characters, with no individual word longer than 16 characters, so it fits the fixed authored title region without font shrinking.
- Derive every service name and description only from the company information or the approved service-section intent.
- "sourceEvidence" must be a short exact quotation copied verbatim from the company information or that approved section's description which supports the service. Include that exact quotation verbatim in the item's description. Do not use general industry knowledge.
- If the supplied sources do not support at least one service item, do not invent one; the response will be rejected explicitly.
- When an approved service section already contains an "items" array, return exactly those items in that order, preserve every item "id" and "title" exactly (return "title" as "name"), and use the approved item description as source intent. Do not add or remove approved items.
`;
const productContract = productSections.length === 0 ? "" : `

STRUCTURED PRODUCT CONTRACT:
- Product structured sections are: ${productSections.map((section: { id: string }) => JSON.stringify(section.id)).join(", ")}.
- Feature sections require 1-12 items; use-case sections require 1-9 items. Never truncate or add filler.
- Every item must contain "id", "name", "description", and "sourceEvidence".
- Without approved items, IDs are "<section id>:feature:1" or "<section id>:use-case:1" in returned order.
- Feature names must be at most 40 characters with no word over 20 characters. Use-case names must be at most 34 characters with no word over 16 characters.
- Derive titles and descriptions only from supplied company information or approved intent. "sourceEvidence" must be an exact supplied quotation included verbatim in the description.
- If approved items exist, preserve their IDs, titles (as "name"), count, and order exactly. Do not add or remove them.
`;

const prompt = `
Analyze the company information below and create professional company profile content based ONLY on the approved profile structure.

Company:
${JSON.stringify(company, null, 2)}

Projects:
${JSON.stringify(
  (projects || []).map((project: { name?: unknown; description?: unknown }) => ({
    name: typeof project.name === "string" ? project.name : "",
    description: typeof project.description === "string" ? project.description.slice(0, 500) : "",
  })),
  null,
  2
)}

Approved Profile Structure:
${JSON.stringify(sections, null, 2)}

APPROVED SECTION MANIFEST — return every entry exactly once, in this order, with these exact IDs and titles:
${approvedSectionManifest(sections)}

${semanticCoverageContract(company)}

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

13. The sections array length must be exactly ${sections.length}. Emit every approved manifest entry exactly once and in manifest order. Never translate, rename, normalize, omit, or duplicate an approved section ID or title.

${serviceContract}
${productContract}

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

For approved service sections, use the STRUCTURED SERVICES CONTRACT above instead. Example shape:

"items": [
  {
    "id": "services:service:1",
    "name": "Source-backed service title",
    "description": "Source-backed service description",
    "sourceEvidence": "Exact quotation from supplied source material"
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
          code: "generated_profile_json_invalid",
          retryable: true,
        },
        { status: 500 }
      );
    }

    const validatedSections = validateGeneratedProfileSections(sections, profile?.sections, { serviceSourceMaterial, productSourceMaterial: serviceSourceMaterial, productTech: isProductTechCompanyType(profile?.companyType ?? ""), experienceYears: company.experience });
    if (!validatedSections.valid) {
      emitProductionTelemetry({ name: "model_generation_rejected", failureClass: "model_contract_rejection", reasonCode: validatedSections.diagnostics[0]?.code ?? "generated_profile_sections_invalid", latencyMs: Date.now() - startedAt });
      return Response.json(
        {
          error: generatedSectionsErrorMessage,
          code: "generated_profile_sections_invalid",
          retryable: true,
          ...(process.env.NODE_ENV !== "production" ? { diagnostics: validatedSections.diagnostics } : {}),
        },
        { status: 502 },
      );
    }

    profile.sections = validatedSections.sections;
    emitProductionTelemetry({ name: "model_generation_completed", latencyMs: Date.now() - startedAt, sectionCount: validatedSections.sections.length });

    return Response.json(profile);
  } catch (error) {
    emitProductionTelemetry({ name: "external_api_failed", failureClass: "external_api_failure", provider: "openai", operation: "generate_profile", reasonCode: error instanceof OpenAI.APIError ? `openai_${error.status}` : "runtime_system_failure" });
    console.error("Generate profile failed", { name: error instanceof Error ? error.name : "UnknownError" });

    return Response.json(
      { error: "Failed to generate company profile." },
      { status: 500 }
    );
  }
}
