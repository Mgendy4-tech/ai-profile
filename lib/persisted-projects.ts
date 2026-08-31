export type PersistedProject = { id: string; name: string; category?: string; description: string; imageUrl: string };
export type PersistedProjectSnapshot = { projects: PersistedProject[]; persistedCount: number; issues: readonly string[] };

export const reconstructPersistedProjects = (raw: string | null): PersistedProjectSnapshot => {
  if (!raw) return { projects: [], persistedCount: 0, issues: [] };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { projects: [], persistedCount: 1, issues: ["projects_data_json_invalid"] }; }
  if (!Array.isArray(value)) return { projects: [], persistedCount: 1, issues: ["projects_data_shape_invalid"] };
  const issues: string[] = [];
  const projects = value.flatMap((entry, index): PersistedProject[] => {
    if (!entry || typeof entry !== "object") { issues.push(`projects.${index}.shape`); return []; }
    const project = entry as Record<string, unknown>;
    if (typeof project.id !== "string" || !project.id.trim()) issues.push(`projects.${index}.id`);
    if (typeof project.name !== "string" || !project.name.trim()) issues.push(`projects.${index}.name`);
    if (typeof project.description !== "string" || !project.description.trim()) issues.push(`projects.${index}.description`);
    if (typeof project.imageUrl !== "string" || !project.imageUrl.trim()) issues.push(`projects.${index}.imageUrl`);
    if (issues.some((issue) => issue.startsWith(`projects.${index}.`))) return [];
    return [{ id: project.id as string, name: project.name as string, description: project.description as string, imageUrl: project.imageUrl as string, ...(typeof project.category === "string" ? { category: project.category } : {}) }];
  });
  return { projects, persistedCount: value.length, issues };
};

export const resolveProjectsForCompanySave = (raw: string | null, currentProjects: readonly PersistedProject[]) => {
  const snapshot = reconstructPersistedProjects(raw);
  return { ...snapshot, projects: snapshot.persistedCount > 0 ? snapshot.projects : [...currentProjects] };
};
