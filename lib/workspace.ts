export const WORKSPACE_STORAGE_KEY = "workspaceData";
export const WORKSPACE_VERSION = 1;
export const MAX_WORKSPACE_PROFILES = 10;

export const WORKSPACE_PROFILE_STATE_KEYS = [
  "companyData",
  "projectsData",
  "profileStructure",
  "generatedProfile",
  "authoredFamilyDecision",
  "authoredVariantDecision",
  "exportDecision",
] as const;

export type WorkspaceProfileStateKey = (typeof WORKSPACE_PROFILE_STATE_KEYS)[number];
export type WorkspaceProfileState = Partial<Record<WorkspaceProfileStateKey, string>>;
export type WorkspaceProfile = {
  id: string;
  displayName: string;
  createdAt: number;
  updatedAt: number;
  state: WorkspaceProfileState;
};
export type Workspace = {
  version: typeof WORKSPACE_VERSION;
  profiles: WorkspaceProfile[];
  activeProfileId: string | null;
};
export type WorkspaceStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type WorkspaceWriteResult = { ok: true; workspace: Workspace } | { ok: false; code: "storage_quota" | "storage_unavailable" };
export type WorkspaceMutationResult = (WorkspaceWriteResult & { profile?: WorkspaceProfile }) | { ok: false; code: "profile_limit" };

const legacyKeys = new Set<string>(WORKSPACE_PROFILE_STATE_KEYS);

const storageFailure = (error: unknown): "storage_quota" | "storage_unavailable" => {
  const name = error && typeof error === "object" && "name" in error ? String((error as { name?: unknown }).name) : "";
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED" ? "storage_quota" : "storage_unavailable";
};

const cloneState = (state: WorkspaceProfileState): WorkspaceProfileState => ({ ...state });
const cloneProfile = (profile: WorkspaceProfile): WorkspaceProfile => ({ ...profile, state: cloneState(profile.state) });
const cloneWorkspace = (workspace: Workspace): Workspace => ({ ...workspace, profiles: workspace.profiles.map(cloneProfile) });

const profileNameFromState = (state: WorkspaceProfileState): string => {
  try {
    const parsed = state.companyData ? JSON.parse(state.companyData) as { name?: unknown } : null;
    return typeof parsed?.name === "string" && parsed.name.trim() ? parsed.name.trim() : "New Profile";
  } catch { return "New Profile"; }
};

const safeId = (): string => {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `profile_${crypto.randomUUID()}`;
  } catch { /* fall through to the local-only fallback */ }
  return `profile_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

export const createWorkspaceProfile = (displayName = "New Profile", now = Date.now()): WorkspaceProfile => ({
  id: safeId(), displayName: displayName.trim() || "New Profile", createdAt: now, updatedAt: now, state: {},
});

const parseWorkspace = (raw: string | null): Workspace | null => {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (value.version !== WORKSPACE_VERSION || !Array.isArray(value.profiles)) return null;
    const seen = new Set<string>();
    const profiles = value.profiles.flatMap((entry): WorkspaceProfile[] => {
      if (!entry || typeof entry !== "object") return [];
      const source = entry as Record<string, unknown>;
      if (typeof source.id !== "string" || !source.id.trim() || seen.has(source.id)) return [];
      const stateSource = source.state && typeof source.state === "object" ? source.state as Record<string, unknown> : {};
      const state: WorkspaceProfileState = {};
      for (const key of WORKSPACE_PROFILE_STATE_KEYS) if (typeof stateSource[key] === "string") state[key] = stateSource[key] as string;
      seen.add(source.id);
      return [{
        id: source.id,
        displayName: typeof source.displayName === "string" && source.displayName.trim() ? source.displayName.trim() : profileNameFromState(state),
        createdAt: typeof source.createdAt === "number" ? source.createdAt : Date.now(),
        updatedAt: typeof source.updatedAt === "number" ? source.updatedAt : Date.now(),
        state,
      }];
    });
    if (!profiles.length) return null;
    const activeProfileId = typeof value.activeProfileId === "string" && profiles.some((profile) => profile.id === value.activeProfileId)
      ? value.activeProfileId
      : profiles[0].id;
    return { version: WORKSPACE_VERSION, profiles, activeProfileId };
  } catch { return null; }
};

const workspaceFromLegacy = (storage: Pick<Storage, "getItem">): Workspace => {
  const state: WorkspaceProfileState = {};
  for (const key of WORKSPACE_PROFILE_STATE_KEYS) {
    try { const value = storage.getItem(key); if (value !== null) state[key] = value; } catch { /* malformed storage is treated as empty */ }
  }
  const profile = createWorkspaceProfile(profileNameFromState(state));
  return { version: WORKSPACE_VERSION, profiles: [profileWithState(profile, state)], activeProfileId: profile.id };
};

const profileWithState = (profile: WorkspaceProfile, state: WorkspaceProfileState): WorkspaceProfile => ({ ...profile, state: cloneState(state) });

const emptyWorkspace = (): Workspace => {
  const profile = createWorkspaceProfile();
  return { version: WORKSPACE_VERSION, profiles: [profile], activeProfileId: profile.id };
};

const writeWorkspace = (storage: WorkspaceStorage, workspace: Workspace): WorkspaceWriteResult => {
  try {
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    return { ok: true, workspace: cloneWorkspace(workspace) };
  } catch (error) { return { ok: false, code: storageFailure(error) }; }
};

export const readWorkspace = (storage: WorkspaceStorage): Workspace => {
  let raw: string | null = null;
  try { raw = storage.getItem(WORKSPACE_STORAGE_KEY); } catch { /* recover below */ }
  const parsed = parseWorkspace(raw);
  if (parsed) return cloneWorkspace(parsed);
  const migrated = workspaceFromLegacy(storage);
  const hasLegacyState = WORKSPACE_PROFILE_STATE_KEYS.some((key) => migrated.profiles[0].state[key] !== undefined);
  const candidate = hasLegacyState ? migrated : emptyWorkspace();
  const saved = writeWorkspace(storage, candidate);
  if (saved.ok && hasLegacyState) for (const key of WORKSPACE_PROFILE_STATE_KEYS) {
    try { storage.removeItem(key); } catch { /* workspace remains canonical even if cleanup is blocked */ }
  }
  return candidate;
};

export const activeWorkspaceProfile = (workspace: Workspace): WorkspaceProfile =>
  cloneProfile(workspace.profiles.find((profile) => profile.id === workspace.activeProfileId) ?? workspace.profiles[0]);

export const readWorkspaceProfileValue = (profile: WorkspaceProfile, key: WorkspaceProfileStateKey): string | null => profile.state[key] ?? null;

export const workspaceStatus = (profile: WorkspaceProfile): "Draft" | "Ready to generate" | "Ready to export" => {
  const company = profile.state.companyData;
  if (!company) return "Draft";
  try {
    const parsed = JSON.parse(company) as { name?: string; about?: string };
    if (!parsed.name?.trim() || !parsed.about?.trim()) return "Draft";
  } catch { return "Draft"; }
  return profile.state.generatedProfile ? "Ready to export" : "Ready to generate";
};

export const getActiveProfileStorage = (storage: WorkspaceStorage): WorkspaceStorage => {
  if (typeof window === "undefined" || storage !== window.localStorage) return storage;
  const scoped: WorkspaceStorage = {
    getItem(key) {
      if (legacyKeys.has(key)) return readWorkspace(storage).profiles.find((profile) => profile.id === readWorkspace(storage).activeProfileId)?.state[key as WorkspaceProfileStateKey] ?? null;
      return storage.getItem(key);
    },
    setItem(key, value) {
      if (!legacyKeys.has(key)) { storage.setItem(key, value); return; }
      const workspace = readWorkspace(storage);
      const active = workspace.profiles.find((profile) => profile.id === workspace.activeProfileId) ?? workspace.profiles[0];
      if (!active) throw new Error("workspace_unavailable");
      const next = cloneWorkspace(workspace);
      const nextActive = next.profiles.find((profile) => profile.id === active.id) ?? next.profiles[0];
      nextActive.state[key as WorkspaceProfileStateKey] = value;
      if (key === "companyData") nextActive.displayName = profileNameFromState(nextActive.state);
      nextActive.updatedAt = Date.now();
      const result = writeWorkspace(storage, next);
      if (!result.ok) { const error = new Error(result.code); error.name = result.code === "storage_quota" ? "QuotaExceededError" : "StorageUnavailable"; throw error; }
    },
    removeItem(key) {
      if (!legacyKeys.has(key)) { storage.removeItem(key); return; }
      const workspace = readWorkspace(storage);
      const next = cloneWorkspace(workspace);
      const active = next.profiles.find((profile) => profile.id === next.activeProfileId);
      if (!active) return;
      delete active.state[key as WorkspaceProfileStateKey];
      active.updatedAt = Date.now();
      const result = writeWorkspace(storage, next);
      if (!result.ok) { const error = new Error(result.code); error.name = result.code === "storage_quota" ? "QuotaExceededError" : "StorageUnavailable"; throw error; }
    },
  };
  return scoped;
};

export const mutateWorkspace = (storage: WorkspaceStorage, update: (workspace: Workspace) => Workspace): WorkspaceMutationResult => {
  const current = readWorkspace(storage);
  const next = update(cloneWorkspace(current));
  const saved = writeWorkspace(storage, next);
  return saved.ok ? { ...saved, profile: activeWorkspaceProfile(saved.workspace) } : saved;
};

export const createProfile = (storage: WorkspaceStorage, displayName = "New Profile"): WorkspaceMutationResult => {
  const current = readWorkspace(storage);
  if (current.profiles.length >= MAX_WORKSPACE_PROFILES) return { ok: false, code: "profile_limit" };
  const profile = createWorkspaceProfile(displayName);
  const next = { ...current, profiles: [...current.profiles, profile], activeProfileId: profile.id };
  const saved = writeWorkspace(storage, next);
  return saved.ok ? { ...saved, profile } : saved;
};

export const switchProfile = (storage: WorkspaceStorage, profileId: string): WorkspaceMutationResult => mutateWorkspace(storage, (workspace) => workspace.profiles.some((profile) => profile.id === profileId) ? { ...workspace, activeProfileId: profileId } : workspace);

export const renameProfile = (storage: WorkspaceStorage, profileId: string, displayName: string): WorkspaceMutationResult => mutateWorkspace(storage, (workspace) => ({ ...workspace, profiles: workspace.profiles.map((profile) => profile.id === profileId ? { ...profile, displayName: displayName.trim() || profile.displayName, updatedAt: Date.now() } : profile) }));

export const duplicateProfile = (storage: WorkspaceStorage, profileId: string): WorkspaceMutationResult => {
  const current = readWorkspace(storage);
  if (current.profiles.length >= MAX_WORKSPACE_PROFILES) return { ok: false, code: "profile_limit" };
  const original = current.profiles.find((profile) => profile.id === profileId);
  if (!original) return { ok: false, code: "storage_unavailable" };
  const copy = createWorkspaceProfile(`${original.displayName} Copy`);
  copy.state = cloneState(original.state);
  const saved = writeWorkspace(storage, { ...current, profiles: [...current.profiles, copy], activeProfileId: copy.id });
  return saved.ok ? { ...saved, profile: copy } : saved;
};

export const deleteProfile = (storage: WorkspaceStorage, profileId: string): WorkspaceMutationResult => {
  const current = readWorkspace(storage);
  if (current.profiles.length <= 1) {
    const replacement = createWorkspaceProfile();
    const saved = writeWorkspace(storage, { ...current, profiles: [replacement], activeProfileId: replacement.id });
    return saved.ok ? { ...saved, profile: replacement } : saved;
  }
  const remaining = current.profiles.filter((profile) => profile.id !== profileId);
  const activeProfileId = current.activeProfileId === profileId ? remaining[0].id : current.activeProfileId;
  const saved = writeWorkspace(storage, { ...current, profiles: remaining, activeProfileId });
  return saved.ok ? { ...saved, profile: activeWorkspaceProfile(saved.workspace) } : saved;
};

export const clearWorkspace = (storage: Pick<Storage, "removeItem">): void => {
  try { storage.removeItem(WORKSPACE_STORAGE_KEY); } catch { /* customer-safe cleanup */ }
  for (const key of WORKSPACE_PROFILE_STATE_KEYS) try { storage.removeItem(key); } catch { /* customer-safe cleanup */ }
};

export const clearActiveProfile = (storage: WorkspaceStorage): WorkspaceMutationResult => mutateWorkspace(storage, (workspace) => ({
  ...workspace,
  profiles: workspace.profiles.map((profile) => profile.id === workspace.activeProfileId ? { ...profile, displayName: "New Profile", state: {}, updatedAt: Date.now() } : profile),
}));
