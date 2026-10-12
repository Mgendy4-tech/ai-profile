"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { authSetupMessage } from "@/lib/auth-env";
import { chooseAuthenticatedWorkspace, CLOUD_OWNER_STORAGE_KEY, hasMeaningfulLocalWorkspace, migrationMarker, workspaceFingerprint, workspaceToCloudPayload } from "@/lib/cloud-workspace";
import { CloudSyncCoordinator, fetchCloudJson, type SyncResult } from "@/lib/cloud-sync-lifecycle";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { readWorkspace, writeWorkspaceSnapshot } from "@/lib/workspace";

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
  const sessionRef = useRef<Session | null>(null);
  const mountedRef = useRef(false);
  const authEventSeenRef = useRef(false);

  const setStatus = useCallback((status: CloudSyncStatus, detail = "") => { setSyncStatus(status); setSyncMessage(detail); emitSyncStatus(status, detail); }, []);

  const coordinatorRef = useRef<CloudSyncCoordinator<Session> | null>(null);
  if (!coordinatorRef.current) coordinatorRef.current = new CloudSyncCoordinator((currentSession) => currentSession.user.id, (status, detail) => { if (mountedRef.current) setStatus(status, detail); });

  const runSync = useCallback(async (currentSession: Session, signal: AbortSignal, preferLocal: boolean): Promise<SyncResult> => {
    if (!supabase) return { ok: false, code: "not_configured", message: authSetupMessage };
      const headers = { Authorization: `Bearer ${currentSession.access_token}`, "Content-Type": "application/json" };
    try {
      if (preferLocal) {
        const local = readWorkspace(localStorage);
        const localFingerprint = workspaceFingerprint(local);
        if (coordinatorRef.current?.getLastSyncedFingerprint() === localFingerprint) return { ok: true, fingerprint: localFingerprint };
        const upload = await fetchCloudJson<{ ok?: boolean; code?: string; warnings?: string[] }>(fetch, "/api/cloud/workspace", { method: "PUT", headers, body: JSON.stringify(workspaceToCloudPayload(local)) }, signal);
        if (!upload.ok) return { ok: false, code: upload.code, message: upload.code === "aborted" ? "Cloud sync was cancelled. Retry when ready." : customerCloudError(upload.code) };
        const uploadBody = upload.body;
        if (!uploadBody.ok) return { ok: false, code: uploadBody.code ?? "cloud_unavailable", message: customerCloudError(uploadBody.code ?? "cloud_unavailable") };
        localStorage.setItem(CLOUD_OWNER_STORAGE_KEY, currentSession.user.id);
        return { ok: true, fingerprint: localFingerprint, message: uploadBody.warnings?.length ? "Synced text and metadata; image files remain in this browser for now." : undefined };
      }
      const response = await fetchCloudJson<{ ok?: boolean; code?: string; workspace?: Parameters<typeof chooseAuthenticatedWorkspace>[0] }>(fetch, "/api/cloud/workspace", { headers }, signal);
      if (!response.ok) return { ok: false, code: response.code, message: response.code === "aborted" ? "Cloud sync was cancelled. Retry when ready." : customerCloudError(response.code) };
      const body = response.body;
      if (!body.ok) return { ok: false, code: body.code ?? "cloud_unavailable", message: customerCloudError(body.code ?? "cloud_unavailable") };
      const local = readWorkspace(localStorage);
      const ownerId = localStorage.getItem(CLOUD_OWNER_STORAGE_KEY);
      const decision = chooseAuthenticatedWorkspace(body.workspace ?? null, local, ownerId, currentSession.user.id);
      const nextFingerprint = workspaceFingerprint(decision.workspace);
      if (!decision.shouldMigrate && nextFingerprint !== workspaceFingerprint(local)) {
        suppressSyncRef.current = true;
        const saved = writeWorkspaceSnapshot(localStorage, decision.workspace);
        if (!saved.ok) { suppressSyncRef.current = false; return { ok: false, code: "local_storage", message: "Your cloud workspace could not be applied locally. Your existing local data is safe; retry when ready." }; }
      }
      if (decision.shouldMigrate || (!body.workspace && hasMeaningfulLocalWorkspace(decision.workspace))) {
        if (coordinatorRef.current?.getLastSyncedFingerprint() !== nextFingerprint) {
          const upload = await fetchCloudJson<{ ok?: boolean; code?: string; warnings?: string[] }>(fetch, "/api/cloud/workspace", { method: "PUT", headers, body: JSON.stringify(workspaceToCloudPayload(decision.workspace)) }, signal);
          if (!upload.ok) return { ok: false, code: upload.code, message: upload.code === "aborted" ? "Cloud sync was cancelled. Retry when ready." : customerCloudError(upload.code) };
          const uploadBody = upload.body;
          if (!uploadBody.ok) return { ok: false, code: uploadBody.code ?? "cloud_unavailable", message: customerCloudError(uploadBody.code ?? "cloud_unavailable") };
          if (decision.shouldMigrate) localStorage.setItem(migrationMarker(currentSession.user.id), "complete");
          localStorage.setItem(CLOUD_OWNER_STORAGE_KEY, currentSession.user.id);
          return { ok: true, fingerprint: nextFingerprint, message: uploadBody.warnings?.length ? "Synced text and metadata; image files remain in this browser for now." : undefined };
        }
      }
      localStorage.setItem(CLOUD_OWNER_STORAGE_KEY, currentSession.user.id);
      return { ok: true, fingerprint: nextFingerprint };
    } catch (error) {
      console.error("[cloud-sync-client]", error);
      return { ok: false, code: "cloud_unavailable", message: "Cloud sync is temporarily unavailable. Your local data is safe; retry when ready." };
    }
  }, [supabase]);

  const sync = useCallback((currentSession: Session, queueIfActive = false): Promise<void> => {
    if (!supabase) { setStatus("sync-failed", authSetupMessage); return Promise.resolve(); }
    const fingerprint = workspaceFingerprint(readWorkspace(localStorage));
    return coordinatorRef.current!.request(currentSession, fingerprint, runSync, queueIfActive);
  }, [runSync, setStatus, supabase]);

  const syncCurrent = useCallback(() => { if (sessionRef.current) void sync(sessionRef.current, true); }, [sync]);

  useEffect(() => {
    coordinatorRef.current?.resume();
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      coordinatorRef.current?.dispose();
      if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => { if (mountedRef.current && !authEventSeenRef.current) { sessionRef.current = data.session; setSession(data.session); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      authEventSeenRef.current = true;
      sessionRef.current = nextSession;
      setSession(nextSession);
      if (nextSession) void sync(nextSession);
      else {
        coordinatorRef.current?.cancel();
        if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
        setStatus("local-only");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [setStatus, supabase, sync]);

  useEffect(() => {
    if (!session) return;
    const onWorkspaceChanged = () => {
      if (suppressSyncRef.current) { suppressSyncRef.current = false; return; }
      if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = window.setTimeout(() => { syncTimerRef.current = null; const currentSession = sessionRef.current; if (currentSession) void sync(currentSession, true); }, 750);
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

export default function AuthShell() {
  const pathname = usePathname();
  return pathname === "/auth" ? null : <AuthPanel />;
}
