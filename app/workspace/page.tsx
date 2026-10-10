"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getAuthoredVariant } from "@/lib/authored-templates/variant-registry";
import {
  MAX_WORKSPACE_PROFILES,
  activeWorkspaceProfile,
  createProfile,
  deleteProfile,
  duplicateProfile,
  readWorkspace,
  readWorkspaceProfileValue,
  renameProfile,
  switchProfile,
  workspaceStatus,
  type Workspace,
  type WorkspaceProfile,
} from "@/lib/workspace";
import CloudSyncIndicator from "@/app/components/cloud-sync-indicator";

const familyLabels: Record<string, string> = {
  "visual-portfolio": "Visual / Portfolio",
  "corporate-services": "Corporate / Services",
  "product-tech": "Product / Tech",
};

const profileCompany = (profile: WorkspaceProfile): { name: string; type: string } => {
  try {
    const value = profile.state.companyData ? JSON.parse(profile.state.companyData) as { name?: unknown; companyType?: unknown } : {};
    return { name: typeof value.name === "string" && value.name.trim() ? value.name : profile.displayName, type: typeof value.companyType === "string" ? value.companyType : "" };
  } catch { return { name: profile.displayName, type: "" }; }
};

const profileSelection = (profile: WorkspaceProfile): string => {
  const family = readWorkspaceProfileValue(profile, "authoredFamilyDecision");
  const variant = readWorkspaceProfileValue(profile, "authoredVariantDecision");
  const familyLabel = family ? familyLabels[family] : "";
  const variantLabel = variant ? getAuthoredVariant(variant)?.displayName : "";
  return [familyLabel, variantLabel].filter(Boolean).join(" · ");
};

const statusClass: Record<ReturnType<typeof workspaceStatus>, string> = {
  Draft: "bg-gray-100 text-gray-700",
  "Ready to generate": "bg-amber-100 text-amber-800",
  "Ready to export": "bg-green-100 text-green-800",
};

export default function WorkspacePage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [message, setMessage] = useState("");

  const refresh = () => setWorkspace(readWorkspace(localStorage));
  useEffect(() => { refresh(); window.addEventListener("workspace-state-changed", refresh); return () => window.removeEventListener("workspace-state-changed", refresh); }, []);

  const notify = () => { window.dispatchEvent(new Event("workspace-state-changed")); refresh(); };
  const create = () => {
    if (!workspace) return;
    if (workspace.profiles.length >= MAX_WORKSPACE_PROFILES) { setMessage(`You can save up to ${MAX_WORKSPACE_PROFILES} profiles in this browser. Delete an unused profile to create another.`); return; }
    const result = createProfile(localStorage);
    if (!result.ok) { setMessage("This profile could not be saved because browser storage is full. Remove an image or delete an unused profile, then try again."); return; }
    setMessage("New profile created."); notify(); window.location.href = "/company";
  };
  const choose = (profileId: string) => {
    const result = switchProfile(localStorage, profileId);
    if (!result.ok) { setMessage("This profile could not be selected. Please try again."); return; }
    notify(); window.location.href = "/company";
  };
  const rename = (profile: WorkspaceProfile) => {
    const nextName = window.prompt("Profile display name", profile.displayName);
    if (nextName === null) return;
    const result = renameProfile(localStorage, profile.id, nextName);
    if (!result.ok) { setMessage("The profile name could not be saved."); return; }
    notify(); setMessage("Profile name updated.");
  };
  const duplicate = (profile: WorkspaceProfile) => {
    if (!workspace) return;
    if (workspace.profiles.length >= MAX_WORKSPACE_PROFILES) { setMessage(`You can save up to ${MAX_WORKSPACE_PROFILES} profiles in this browser.`); return; }
    const result = duplicateProfile(localStorage, profile.id);
    if (!result.ok) { setMessage("This profile could not be duplicated because browser storage is full."); return; }
    notify(); setMessage("Profile duplicated. The copy is now active.");
  };
  const remove = (profile: WorkspaceProfile) => {
    if (!window.confirm(`Delete ${profile.displayName}? This removes only this saved profile.`)) return;
    const result = deleteProfile(localStorage, profile.id);
    if (!result.ok) { setMessage("The profile could not be deleted."); return; }
    notify(); setMessage("Profile deleted safely.");
  };

  const activeId = workspace?.activeProfileId;
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">Workspace</p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-gray-900">Your company profiles</h1>
            <p className="mt-3 max-w-2xl text-gray-600">Keep each company&apos;s projects, generated profile, brand details, and style choice separate in this browser.</p>
          </div>
          <CloudSyncIndicator />
          <button type="button" onClick={create} className="rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800">New Profile</button>
        </div>
        <p className="mt-3 text-xs text-gray-500">{workspace?.profiles.length ?? 0} of {MAX_WORKSPACE_PROFILES} profiles used</p>
        {message && <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}</p>}
        <section aria-label="Saved company profiles" className="mt-8 grid min-w-0 gap-4 md:grid-cols-2">
          {(workspace?.profiles ?? []).map((profile) => {
            const company = profileCompany(profile);
            const status = workspaceStatus(profile);
            const selection = profileSelection(profile);
            return <article key={profile.id} className={`min-w-0 rounded-2xl border bg-white p-5 shadow-sm ${profile.id === activeId ? "border-gray-900 ring-2 ring-gray-200" : "border-gray-200"}`}>
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0"><h2 className="truncate text-xl font-semibold text-gray-900">{profile.displayName || company.name}</h2><p className="mt-1 truncate text-sm text-gray-600">{company.type || "Company type not set"}</p></div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass[status]}`}>{status}</span>
              </div>
              <p className="mt-4 text-xs text-gray-500">Last updated {new Date(profile.updatedAt).toLocaleDateString()}</p>
              {selection && <p className="mt-2 text-xs text-gray-600">{selection}</p>}
              {profile.id === activeId && <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-gray-900">Current profile</p>}
              <div className="mt-5 flex flex-wrap gap-2">
                {profile.id !== activeId && <button type="button" onClick={() => choose(profile.id)} className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white">Switch to this profile</button>}
                <Link href={profile.id === activeId ? "/company" : "/workspace"} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-900">Open</Link>
                <button type="button" onClick={() => rename(profile)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-900">Rename</button>
                <button type="button" onClick={() => duplicate(profile)} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-900">Duplicate</button>
                <button type="button" onClick={() => remove(profile)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700">Delete</button>
              </div>
            </article>;
          })}
        </section>
        {!workspace?.profiles.length && <div className="mt-8 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center"><p className="text-gray-700">No active profile is selected.</p><button type="button" onClick={create} className="mt-4 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">Create your first profile</button></div>}
        <p className="mt-8 text-sm text-gray-600"><Link href={activeId ? "/company" : "/workspace"} className="font-medium text-gray-900 underline">Continue with the active profile</Link></p>
      </div>
    </main>
  );
}
