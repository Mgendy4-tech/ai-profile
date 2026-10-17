"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { acknowledgeCloudWrite, pendingCloudWrite } from "@/lib/cloud-pending-write";
import { authSetupMessage } from "@/lib/auth-env";
import { chooseAuthenticatedWorkspace, CLOUD_OWNER_STORAGE_KEY, hasMeaningfulLocalWorkspace, migrationMarker, shouldMigrateLocalWorkspaceAssets, workspaceFingerprint, workspaceToCloudPayload } from "@/lib/cloud-workspace";
import { CloudSyncCoordinator, fetchCloudJson, type SyncResult } from "@/lib/cloud-sync-lifecycle";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { readWorkspace, writeWorkspaceSnapshot } from "@/lib/workspace";
import { clearTrustedHydratedCloudAssets, hydrateWorkspaceAssets, migrateLocalWorkspaceAssets } from "@/lib/cloud-assets";
import { reportClientFailure } from "@/lib/client-observability";
import ClientObservability from "@/app/components/client-observability";
import { passwordRecoveryRedirect } from "@/lib/site-url";
import { authFailureCode, customerAuthError, type AuthMessageMode } from "@/lib/auth-messages";
import { authPageDestination } from "@/lib/auth-redirect";
import { canUpdatePasswordFromRecovery, isPasswordRecoveryEvent, PASSWORD_RECOVERY_REQUIRED_MESSAGE } from "@/lib/password-recovery";

export type CloudSyncStatus = "local-only" | "syncing" | "synced" | "sync-failed";
type AuthMode = AuthMessageMode;

const statusText: Record<CloudSyncStatus, string> = { "local-only": "Local only", syncing: "Syncing…", synced: "Synced", "sync-failed": "Sync failed — Retry" };
const statusClass: Record<CloudSyncStatus, string> = { "local-only": "text-gray-600", syncing: "text-amber-700", synced: "text-green-700", "sync-failed": "text-red-700" };

const emitSyncStatus = (status: CloudSyncStatus, message = "") => {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("cloud-sync-status", { detail: { status, message } }));
};

const customerCloudError = (code: string): string => code === "not_configured" ? authSetupMessage : code === "unauthorized" ? "Your sign-in session expired. Please sign in again." : "Cloud sync is temporarily unavailable. Your local data is safe; retry when you are online.";

export function AuthPanel({ expanded = false }: { expanded?: boolean }) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(supabase ? "local-only" : "sync-failed");
  const [syncMessage, setSyncMessage] = useState(supabase ? "" : authSetupMessage);
  const [recoveryVerified, setRecoveryVerified] = useState(false);
  const [recoveryRoute, setRecoveryRoute] = useState(false);
  const recoveryUserIdRef = useRef<string | null>(null);
  const suppressSyncRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const mountedRef = useRef(false);
  const authEventSeenRef = useRef(false);

  const setStatus = useCallback((status: CloudSyncStatus, detail = "") => { setSyncStatus(status); setSyncMessage(detail); if (status === "syncing" || status === "synced") setMessage(""); emitSyncStatus(status, detail); }, []);

  const coordinatorRef = useRef<CloudSyncCoordinator<Session> | null>(null);
  if (!coordinatorRef.current) coordinatorRef.current = new CloudSyncCoordinator((currentSession) => currentSession.user.id, (status, detail) => { if (mountedRef.current) setStatus(status, detail); });

  const runSync = useCallback(async function runSync(currentSession: Session, signal: AbortSignal, preferLocal: boolean): Promise<SyncResult> {
    if (!supabase) return { ok: false, code: "not_configured", message: authSetupMessage };
      const headers = { Authorization: `Bearer ${currentSession.access_token}`, "Content-Type": "application/json" };
    try {
      const ownerId = localStorage.getItem(CLOUD_OWNER_STORAGE_KEY);
      const pendingRevision = pendingCloudWrite(localStorage, currentSession.user.id);
      if (pendingRevision) preferLocal = true;
      const mayMigrateLocalAssets = shouldMigrateLocalWorkspaceAssets(ownerId, currentSession.user.id);
      if (preferLocal && !mayMigrateLocalAssets) preferLocal = false;
      if (preferLocal) {
        const migrated = await migrateLocalWorkspaceAssets(readWorkspace(localStorage), supabase);
        if (signal.aborted) return { ok: false, code: "aborted" };
        if (pendingCloudWrite(localStorage, currentSession.user.id) !== pendingRevision) return runSync(currentSession, signal, true);
        if (migrated.uploaded > 0) {
          suppressSyncRef.current = true;
          const savedLocal = writeWorkspaceSnapshot(localStorage, migrated.workspace, false);
          if (!savedLocal.ok) { suppressSyncRef.current = false; return { ok: false, code: "local_storage", message: "Your workspace is safe locally, but the cloud asset migration could not be recorded. Retry when ready." }; }
        }
        const local = migrated.workspace;
        const localFingerprint = workspaceFingerprint(local);
        if (coordinatorRef.current?.getLastSyncedFingerprint() === localFingerprint) { acknowledgeCloudWrite(localStorage, currentSession.user.id, pendingRevision); return { ok: true, fingerprint: localFingerprint }; }
        const upload = await fetchCloudJson<{ ok?: boolean; code?: string; warnings?: string[] }>(fetch, "/api/cloud/workspace", { method: "PUT", headers, body: JSON.stringify(workspaceToCloudPayload(local)) }, signal);
      if (!upload.ok) { reportClientFailure({ category: "cloud_sync_failure", code: upload.code, surface: "workspace_sync" }); return { ok: false, code: upload.code, message: upload.code === "aborted" ? "Cloud sync was cancelled. Retry when ready." : customerCloudError(upload.code) }; }
        const uploadBody = upload.body;
      if (!uploadBody.ok) { reportClientFailure({ category: "cloud_sync_failure", code: uploadBody.code ?? "cloud_unavailable", surface: "workspace_sync" }); return { ok: false, code: uploadBody.code ?? "cloud_unavailable", message: customerCloudError(uploadBody.code ?? "cloud_unavailable") }; }
        localStorage.setItem(CLOUD_OWNER_STORAGE_KEY, currentSession.user.id);
        acknowledgeCloudWrite(localStorage, currentSession.user.id, pendingRevision);
        return { ok: true, fingerprint: localFingerprint, message: migrated.failed || uploadBody.warnings?.length ? "Workspace synced. One or more images still need a cloud upload retry." : undefined };
      }
      const response = await fetchCloudJson<{ ok?: boolean; code?: string; workspace?: Parameters<typeof chooseAuthenticatedWorkspace>[0] }>(fetch, "/api/cloud/workspace", { headers }, signal);
      if (!response.ok) { reportClientFailure({ category: "cloud_sync_failure", code: response.code, surface: "workspace_sync" }); return { ok: false, code: response.code, message: response.code === "aborted" ? "Cloud sync was cancelled. Retry when ready." : customerCloudError(response.code) }; }
      const body = response.body;
      if (!body.ok) { reportClientFailure({ category: "cloud_sync_failure", code: body.code ?? "cloud_unavailable", surface: "workspace_sync" }); return { ok: false, code: body.code ?? "cloud_unavailable", message: customerCloudError(body.code ?? "cloud_unavailable") }; }
      if (pendingCloudWrite(localStorage, currentSession.user.id)) return runSync(currentSession, signal, true);
      const local = readWorkspace(localStorage);
      const localMigration = mayMigrateLocalAssets ? await migrateLocalWorkspaceAssets(local, supabase) : { workspace: local, uploaded: 0, failed: 0 };
      if (pendingCloudWrite(localStorage, currentSession.user.id)) return runSync(currentSession, signal, true);
      if (localMigration.uploaded > 0) {
        suppressSyncRef.current = true;
        const savedLocal = writeWorkspaceSnapshot(localStorage, localMigration.workspace, false);
        if (!savedLocal.ok) { suppressSyncRef.current = false; return { ok: false, code: "local_storage", message: "Your workspace is safe locally, but the cloud asset migration could not be recorded. Retry when ready." }; }
      }
      const migratedLocal = localMigration.workspace;
      const decision = chooseAuthenticatedWorkspace(body.workspace ?? null, migratedLocal, ownerId, currentSession.user.id);
      const hydratedWorkspace = body.workspace ? await hydrateWorkspaceAssets(decision.workspace, supabase) : decision.workspace;
      if (body.workspace) decision.workspace = hydratedWorkspace;
      if (pendingCloudWrite(localStorage, currentSession.user.id)) return runSync(currentSession, signal, true);
      const nextFingerprint = workspaceFingerprint(decision.workspace);
      if (!decision.shouldMigrate && nextFingerprint !== workspaceFingerprint(migratedLocal)) {
        suppressSyncRef.current = true;
        const saved = writeWorkspaceSnapshot(localStorage, decision.workspace, false);
        if (!saved.ok) { suppressSyncRef.current = false; return { ok: false, code: "local_storage", message: "Your cloud workspace could not be applied locally. Your existing local data is safe; retry when ready." }; }
      }
      if (decision.shouldMigrate || (!body.workspace && hasMeaningfulLocalWorkspace(decision.workspace))) {
        if (coordinatorRef.current?.getLastSyncedFingerprint() !== nextFingerprint) {
          const upload = await fetchCloudJson<{ ok?: boolean; code?: string; warnings?: string[] }>(fetch, "/api/cloud/workspace", { method: "PUT", headers, body: JSON.stringify(workspaceToCloudPayload(decision.workspace)) }, signal);
          if (!upload.ok) { reportClientFailure({ category: "cloud_sync_failure", code: upload.code, surface: "workspace_sync" }); return { ok: false, code: upload.code, message: upload.code === "aborted" ? "Cloud sync was cancelled. Retry when ready." : customerCloudError(upload.code) }; }
          const uploadBody = upload.body;
          if (!uploadBody.ok) { reportClientFailure({ category: "cloud_sync_failure", code: uploadBody.code ?? "cloud_unavailable", surface: "workspace_sync" }); return { ok: false, code: uploadBody.code ?? "cloud_unavailable", message: customerCloudError(uploadBody.code ?? "cloud_unavailable") }; }
          if (decision.shouldMigrate) localStorage.setItem(migrationMarker(currentSession.user.id), "complete");
          localStorage.setItem(CLOUD_OWNER_STORAGE_KEY, currentSession.user.id);
          return { ok: true, fingerprint: nextFingerprint, message: uploadBody.warnings?.length ? "Workspace synced. One or more images still need a cloud upload retry." : undefined };
        }
      }
      localStorage.setItem(CLOUD_OWNER_STORAGE_KEY, currentSession.user.id);
      return { ok: true, fingerprint: nextFingerprint };
    } catch (error) {
      reportClientFailure({ category: "cloud_sync_failure", code: "unexpected_sync_error", surface: "workspace_sync" });
      return { ok: false, code: "cloud_unavailable", message: "Cloud sync is temporarily unavailable. Your local data is safe; retry when ready." };
    }
  }, [supabase]);

  const sync = useCallback((currentSession: Session, queueIfActive = false): Promise<void> => {
    if (!supabase) { setStatus("sync-failed", authSetupMessage); return Promise.resolve(); }
    const fingerprint = workspaceFingerprint(readWorkspace(localStorage));
    return coordinatorRef.current!.request(currentSession, fingerprint, runSync, queueIfActive);
  }, [runSync, setStatus, supabase]);

  const syncCurrent = useCallback(() => { if (sessionRef.current && syncStatus !== "syncing") void sync(sessionRef.current, true); }, [sync, syncStatus]);

  const redirectAfterAuthentication = useCallback(() => {
    if (typeof window === "undefined" || window.location.pathname !== "/auth") return;
    const destination = authPageDestination(window.location.search, window.location.hash);
    if (destination) router.replace(destination);
  }, [router]);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "reset") {
      setRecoveryRoute(true);
      setMessage(PASSWORD_RECOVERY_REQUIRED_MESSAGE);
    }
  }, []);

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
    void supabase.auth.getSession().then(({ data }) => { if (mountedRef.current && !authEventSeenRef.current) { sessionRef.current = data.session; setSession(data.session); if (data.session) void sync(data.session).then(() => redirectAfterAuthentication()); } });
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      authEventSeenRef.current = true;
      sessionRef.current = nextSession;
      setSession(nextSession);
      if (isPasswordRecoveryEvent(event)) {
        setRecoveryVerified(true);
        recoveryUserIdRef.current = nextSession?.user.id ?? null;
        setEmail(nextSession?.user.email ?? "");
        setMode("reset-password");
        setMessage("");
      }
      if (nextSession) { void sync(nextSession).then(() => { if (!isPasswordRecoveryEvent(event)) redirectAfterAuthentication(); }); }
      else {
        setRecoveryVerified(false);
        recoveryUserIdRef.current = null;
        clearTrustedHydratedCloudAssets();
        coordinatorRef.current?.cancel();
        if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
        setStatus("local-only");
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [redirectAfterAuthentication, setStatus, supabase, sync]);

  useEffect(() => {
    if (!session) return;
    const onWorkspaceChanged = () => {
      if (suppressSyncRef.current) { suppressSyncRef.current = false; return; }
      if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = window.setTimeout(() => { syncTimerRef.current = null; const currentSession = sessionRef.current; if (currentSession) void sync(currentSession, true); }, 750);
    };
    const onCloudSyncRetry = () => { const currentSession = sessionRef.current; if (currentSession) void sync(currentSession, true); };
    window.addEventListener("workspace-state-changed", onWorkspaceChanged);
    window.addEventListener("cloud-sync-retry", onCloudSyncRetry);
    return () => { window.removeEventListener("workspace-state-changed", onWorkspaceChanged); window.removeEventListener("cloud-sync-retry", onCloudSyncRetry); if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current); };
  }, [session, sync]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) { setMessage(authSetupMessage); return; }
    setBusy(true); setMessage("");
    if (mode === "reset-request") {
      const result = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: passwordRecoveryRedirect(window.location.origin) });
      setBusy(false);
      if (result.error) reportClientFailure({ category: "auth_failure", code: authFailureCode(result.error, mode), surface: "password_recovery" });
      setMessage(result.error ? customerAuthError(result.error, mode) : "If an account exists for that email, a password-reset link is on its way.");
      return;
    }
    if (mode === "reset-password") {
      if (!canUpdatePasswordFromRecovery(recoveryVerified)) {
        setBusy(false);
        setMessage(PASSWORD_RECOVERY_REQUIRED_MESSAGE);
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const activeRecoverySession = sessionData.session;
      if (!activeRecoverySession || activeRecoverySession.user.id !== recoveryUserIdRef.current) {
        setBusy(false);
        reportClientFailure({ category: "auth_failure", code: "recovery_session_invalid", surface: "password_recovery", status: 401 });
        setMessage(customerAuthError({ code: "session_not_found" }, mode));
        return;
      }
      const result = await supabase.auth.updateUser({ password });
      setBusy(false);
      if (result.error) { reportClientFailure({ category: "auth_failure", code: authFailureCode(result.error, mode), surface: "password_recovery", status: result.error.status }); setMessage(customerAuthError(result.error, mode)); return; }
      setPassword(""); setMode("sign-in"); setMessage("Your password was updated. You can sign in again.");
      return;
    }
    const result = mode === "sign-in" ? await supabase.auth.signInWithPassword({ email: email.trim(), password }) : await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (result.error) { reportClientFailure({ category: "auth_failure", code: authFailureCode(result.error, mode), surface: "authentication" }); setMessage(customerAuthError(result.error, mode)); return; }
    if (result.data.session) await sync(result.data.session).then(() => redirectAfterAuthentication());
    setMessage(mode === "sign-up" && !result.data.session ? "Check your email to confirm your account, then sign in to continue." : "Signed in. Checking your private workspace…");
  };

  const signOut = async () => { if (!supabase) return; await supabase.auth.signOut(); setMessage("Signed out. Your account workspace remains securely stored; this browser copy is no longer synced."); };

  if (!expanded) return null;

  const resetRequest = mode === "reset-request";
  const resetPassword = mode === "reset-password" && recoveryVerified;
  const recoveryRouteWithoutVerification = mode === "reset-password" && !recoveryVerified;
  const heading = resetPassword ? "Choose a new password" : session ? resetRequest ? "Reset your password" : "Your workspace is account-ready" : "Sign in or create your account";
  const description = resetPassword ? `Updating the password for ${session?.user.email ?? email}.` : session ? "Changes sync to your account. Signed-in profiles and images are stored in your private cloud workspace." : "Create an account or sign in to save your profile, projects, and images in a private workspace.";
  const visibleMessage = recoveryRoute && !recoveryVerified ? PASSWORD_RECOVERY_REQUIRED_MESSAGE : message || syncMessage;
  return <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">Account and sync</p><h1 className="mt-2 text-2xl font-bold text-gray-900">{heading}</h1><p className="mt-2 max-w-xl text-sm leading-6 text-gray-600">{description}</p></div><span className={`text-sm font-semibold ${statusClass[syncStatus]}`}>{statusText[syncStatus]}</span></div>{session && !resetPassword && !resetRequest ? <div className="mt-5 flex flex-wrap items-center gap-3"><span className="text-sm text-gray-700">{session.user.email}</span><button type="button" onClick={syncCurrent} disabled={syncStatus === "syncing" || !supabase} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900 disabled:cursor-not-allowed disabled:opacity-50">{syncStatus === "syncing" ? "Syncing…" : "Retry sync"}</button><button type="button" onClick={() => { setMode("reset-request"); setEmail(session.user.email ?? ""); setMessage(""); }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900">Reset password</button><button type="button" onClick={signOut} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900">Sign out</button></div> : resetPassword ? <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]"><input aria-label="New password" type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="New password" className="auth-input rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-slate-950 placeholder:text-slate-500"/><button type="submit" disabled={busy || !supabase} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Working…" : "Update password"}</button></form> : recoveryRouteWithoutVerification ? <p role="status" className="mt-5 text-sm text-gray-700">{PASSWORD_RECOVERY_REQUIRED_MESSAGE}</p> : <form onSubmit={submit} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">{!resetPassword && <input aria-label="Email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="auth-input rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-slate-950 placeholder:text-slate-500"/>}{!resetRequest && <input aria-label="Password" type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" className="auth-input rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-slate-950 placeholder:text-slate-500"/>}<button type="submit" disabled={busy || !supabase} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{busy ? "Working…" : resetRequest ? "Send reset email" : mode === "sign-in" ? "Sign in" : "Sign up"}</button></form>}{!session && !resetPassword && !recoveryRouteWithoutVerification && <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium text-gray-900"><button type="button" onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")} className="underline">{mode === "sign-in" ? "Create account" : "Sign in"}</button>{mode === "sign-in" && <button type="button" onClick={() => { setMode("reset-request"); setMessage(""); }} className="underline">Forgot password?</button>}</div>}{visibleMessage && <p role="status" className="mt-4 text-sm text-gray-700">{visibleMessage}</p>}</section>;
}

export default function AuthShell() {
  const pathname = usePathname();
  return <><ClientObservability />{pathname === "/auth" || pathname === "/" ? null : <AuthPanel />}</>;
}
