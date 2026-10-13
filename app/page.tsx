'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { readApplicationStorage } from "@/lib/local-profile-data";
import { readWorkspace, workspaceStatus } from "@/lib/workspace";
import LnkditHeader from "@/app/components/lnkdit-header";

export default function Home() {
  const [companyName, setCompanyName] = useState("");
  const [resumeHref, setResumeHref] = useState("/company");

  useEffect(() => {
    const loadCompanyName = () => {
      try {
        const savedCompanyData = readApplicationStorage(localStorage, "companyData");

        if (!savedCompanyData) {
          return;
        }

        const parsedCompanyData = JSON.parse(savedCompanyData) as {
          name?: unknown;
        };

        if (typeof parsedCompanyData.name === "string" && parsedCompanyData.name.trim()) {
          setCompanyName(parsedCompanyData.name.trim());
          const workspace = readWorkspace(localStorage);
          const active = workspace.profiles.find((profile) => profile.id === workspace.activeProfileId) ?? workspace.profiles[0];
          setResumeHref(active && workspaceStatus(active) === "Ready to export" ? "/generate" : "/company");
        }
      } catch {
        setCompanyName("");
      }

    };

    const loadTimeout = window.setTimeout(loadCompanyName, 0);

    return () => window.clearTimeout(loadTimeout);
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto max-w-6xl">
        <LnkditHeader><span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 sm:inline-flex">Company profile workspace</span></LnkditHeader>
        <div className="mt-16 max-w-3xl sm:mt-24">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-700">Professional profiles, made easier</p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
            {companyName ? `Continue building ${companyName}.` : "Professional company profiles, made easier."}
          </h1>

          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Create, refine, and export a polished company profile in one place. Start as a guest, then sign in when you want private cloud backup and access on another device.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href={resumeHref} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">{companyName ? `Continue with ${companyName}` : "Create your profile"}</Link>
            <Link href="/workspace" className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-500">View workspace</Link>
          </div>
          <p className="mt-3 max-w-2xl text-sm text-slate-500">Guest mode stays in this browser. An account adds private cloud backup, cross-device access, and recovery.</p>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-3">

          <Link href="/company" className="block h-full cursor-pointer">
            <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
              <h2 className="text-xl font-semibold text-slate-950">Company details</h2>

              <p className="mt-2 text-slate-600">
                Add the essentials first. Projects are optional for service-led profiles.
              </p>
            </div>
          </Link>

          <Link href="/workspace" className="block h-full cursor-pointer">
            <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
              <h2 className="text-xl font-semibold text-slate-950">Workspace</h2>
              <p className="mt-2 text-slate-600">Switch, duplicate, or start another company profile.</p>
            </div>
          </Link>

          {companyName && (
            <Link href="/generate" className="block h-full cursor-pointer">
            <div className="h-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
              <h2 className="text-xl font-semibold text-slate-950">Generate profile</h2>

              <p className="mt-2 text-slate-600">
                Turn your approved company information into polished profile content.
              </p>
            </div>
            </Link>
          )}

        </div>
      </div>
    </main>
  );
}
