"use client";

import { useEffect, useState } from "react";
import type { CloudSyncStatus } from "@/app/auth/auth-shell";

export default function CloudSyncIndicator() {
  const [status, setStatus] = useState<CloudSyncStatus>("local-only");
  const [message, setMessage] = useState("");
  useEffect(() => { const handle = (event: Event) => { const detail = (event as CustomEvent<{ status?: CloudSyncStatus; message?: string }>).detail; if (detail?.status) setStatus(detail.status); setMessage(detail?.message ?? ""); }; window.addEventListener("cloud-sync-status", handle); return () => window.removeEventListener("cloud-sync-status", handle); }, []);
  const label = status === "syncing" ? "Syncing…" : status === "synced" ? "Synced" : status === "sync-failed" ? "Sync failed — Retry" : "Local only";
  const color = status === "synced" ? "text-green-700" : status === "sync-failed" ? "text-red-700" : status === "syncing" ? "text-amber-700" : "text-gray-600";
  return <p role="status" className={`text-xs font-semibold ${color}`}>{label}{message ? ` — ${message}` : ""}</p>;
}
