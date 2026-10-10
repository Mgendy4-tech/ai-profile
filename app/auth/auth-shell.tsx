"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { authSetupMessage } from "@/lib/auth-env";
import { chooseAuthenticatedWorkspace, CLOUD_OWNER_STORAGE_KEY, migrationMarker, workspaceToCloudPayload } from "@/lib/cloud-workspace";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { createEmptyWorkspace, readWorkspace, writeWorkspaceSnapshot } from "@/lib/workspace";

export type CloudSyncStatus = "local-only" | "syncing" | "synced" | "sync-failed";
type AuthMode = "sign-in" | "sign-up";

const statusText: Record<CloudSyncStatus, string> = { "local-only": "Local only", syncing: "Syncing…", synced: "Synced", "sync-failed": "Sync failed — Retry" };
const statusClass: Record<CloudSyncStatus, string> = { "local-only": "text-gray-600", syncing: "text-amber-700", synced: "text-green-700", "sync-failed": "text-red-700" };

const emitSyncStatus = (status: CloudSyncStatus, message = "") => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cloud-sync-status", { detail: { status, message } }));
};

const customerCloudError = (code: string): string => code === "not_configured" ? authSetupMessage : code === "unauthorized" ? "Your sign-in session expired. Please sign in again." : "Cloud sync is temporarily unavailable. Your local data is safe; retry when you are online.";

export function AuthPanel({ expanded = false }: { expanded?: boolean }) {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(supabase ? "local-only" : "sync-failed");
  const [syncMessage, setSyncMessage] = useState(supabase ? "" : authSetupMessage);
  const suppressSyncRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  const accessTokenRef = useRef<string | null>(null);

  const setStatus = useCallback((status: CloudSyncStatus, detail = "") => { setSyncStatus(status); setSyncMessage(detail); emitSyncStatus(status, detail); }, []);

  const sync = useCallback(async (currentSession: Session) => {
    if (!supabase) { setStatus("sync-failed", authSetupMessage); return; }
    accessTokenRef.current = currentSession.access_token;
    setStatus("syncing");
    const headers = { Authorization: `Bearer ${currentSession.access_token}`, "Content-Type": "application/json" };
    try {
      const response = await fetch("/api/cloud/workspace", { headers });
      const body = await response.json().catch(() => ({})) as { ok?: boolean; code?: string; workspace?: Parameters<typeof chooseAuthenticatedWorkspace>[0] };
      if (!response.ok || !body.ok) { setStatus("sync-failed", customerCloudError(body.code ?? "cloud_unavailable")); return; }
      const local = readWorkspace(localStorage);
      const ownerId = localStorage.getItem(CLOUD_OWNER_STORAGE_KEY);
      const decision = chooseAuthenticatedWorkspace(body.workspace ?? null, local, ownerId, currentSession.user.id);
      if (decision.workspace !== local && !decision.shouldMigrate) {
        suppressSyncRef.current = true;
        writeWorkspaceSnapshot(localStorage, decision.workspace);
      }
      if (decision.shouldMigrate || !body.workspace) {
        const upload = await fetch("/api/cloud/workspace", { method: "PUT", headers, body: JSON.stringify(workspaceToCloudPayload(decision.workspace)) });
        const uploadBody = await upload.json().catch(() => ({})) as { ok?: boolean; code?: string; warnings?: string[] };
        if (!upload.ok || !uploadBody.ok) { setStatus("sync-failed", customerCloudError(uploadBody.code ?? "cloud_unavailable")); return; }
        if (decision.shouldMigrate) localStorage.setItem(migrationMarker(currentSession.user.id), "complete");
        const warning = uploadBody.warnings?.length ? "Synced text and metadata; image files remain in this browser for now." : "";
        localStorage.setItem(CLOUD_OWNER_STORAGE_KEY, currentSession.user.id);
        setStatus("synced", warning);
        return;
      }
      localStorage.setItem(CLOUD_OWNER_STORAGE_KEY, currentSession.user.id);
      setStatus("synced");
    } catch (error) {
      console.error("[cloud-sync-client]", error);
      setStatus("sync-failed", "Cloud sync is temporarily unavailable. Your local data is safe; retry when you are online.");
    }
  }, [setStatus, supabase]);

  const syncCurrent = useCallback(() => { if (session) void sync(session); }, [session, sync]);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) void sync(nextSession);
      else { accessTokenRef.current = null; setStatus("local-only"); }
    });
    return () => listener.subscription.unsubscribe();
  }, [setStatus, supabase, sync]);

  useEffect(() => {
    if (!session) return;
    const onWorkspaceChanged = () => {
      if (suppressSyncRef.current) { suppressSyncRef.current = false; return; }
      if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = window.setTimeout(() => void sync(session), 750);
    };
    window.addEventListener("workspace-state-changed", onWorkspaceChanged);
    return () => { window.removeEventListener("workspace-state-changed", onWorkspaceChanged); if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current); };
  }, [session, sync]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) { setMessage(authSetupMessage); return; }
    setBusy(true); setMessage("");
    const result = mode === "sign-in" ? await supabase.auth.signInWithPassword({ email: email.trim(), password }) : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (result.error) { setMessage("We could not complete that request. Check your email and password, then try again."); return; }
    setMessage(mode === "sign-up" && !result.data.session ? "Check your email to confirm your account, then sign in." : "Signed in. Your workspace will sync shortly.");
  };

  const signOut = async () => { if (!supabase) return; await supabase.auth.signOut(); setMessage("Signed out. Your local workspace remains available on this browser."); };

  if (!expanded) return <div className="fixed right-4 top-4 z-50 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur"><div className="flex items-center gap-3 text-xs"><span className="font-semibold text-gray-900">{session ? `Signed in as ${session.user.email ?? "account"}` : "Guest mode"}</span>{session ? <><span className={statusClass[syncStatus]}>{statusText[syncStatus]}</span><button type="button" onClick={syncCurrent} className="font-medium text-gray-900 underline">Retry</button><button type="button" onClick={signOut} className="font-medium text-gray-900 underline">Sign out</button></> : <Link href="/auth" className="font-medium text-gray-900 underline">Sign in to sync</Link>}</div></div>;

  return <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">Account and sync</p><h1 className="mt-2 text-2xl font-bold text-gray-900">{session ? "Your workspace is account-ready" : "Keep working as a guest"}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-gray-600">{session ? "Changes sync to your account. Your local cache remains available if the network is interrupted." : "Guest mode stays local. Sign in when you want your profiles available on another browser or device."}</p></div><span className={`text-sm font-semibold ${statusClass[syncStatus]}`}>{statusText[syncStatus]}</span></div>{session ? <div className="mt-5 flex flex-wrap items-center gap-3"><span className="text-sm text-gray-700">{session.user.email}</span><button type="button" onClick={syncCurrent} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900">Retry sync</button><button type="button" onClick={signOut} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900">Sign out</button></div> : <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><input aria-label="Email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="rounded-lg border border-gray-300 px-3 py-2 text-sm"/><input aria-label="Password" type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="rounded-lg border border-gray-300 px-3 py-2 text-sm"/><button type="submit" disabled={busy || !supabase} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Working…" : mode === "sign-in" ? "Sign in" : "Sign up"}</button></form>}{!session && <button type="button" onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")} className="mt-3 text-sm font-medium text-gray-900 underline">{mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}</button>}{(message || syncMessage) && <p role="status" className="mt-4 text-sm text-gray-700">{message || syncMessage}</p>}</section>;
}

export default function AuthShell() { return <AuthPanel />; }
