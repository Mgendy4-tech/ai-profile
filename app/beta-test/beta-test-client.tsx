"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { betaFixtureImageState, createBetaFixture, loadBetaFixture, type BetaFixture, type BetaFixtureId } from "@/lib/beta-test-fixtures";
import { clearApplicationLocalData } from "@/lib/local-profile-data";
import { generatedProjectEvidenceCount, readPersistedGeneratedProfile } from "@/lib/generated-profile-storage";
import { familyChoices } from "@/lib/authored-templates/family-selection";

const createProjectImage = () => {
  const canvas = document.createElement("canvas"); canvas.width = 640; canvas.height = 480;
  const context = canvas.getContext("2d"); if (!context) throw new Error("Fixture image canvas is unavailable.");
  const gradient = context.createLinearGradient(0, 0, 640, 480); gradient.addColorStop(0, "#6f5848"); gradient.addColorStop(0.55, "#d8c9ad"); gradient.addColorStop(1, "#3e5059");
  context.fillStyle = gradient; context.fillRect(0, 0, 640, 480); context.fillStyle = "rgba(242,236,224,0.72)"; context.fillRect(60, 70, 280, 290); context.fillStyle = "rgba(39,34,30,0.72)"; context.fillRect(380, 48, 165, 345);
  return canvas.toDataURL("image/png");
};

const buttonClass = "rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700";
const secondaryClass = "rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-900 transition hover:bg-gray-50";
type BetaFamilyDiagnostic = { expectedFamily: BetaFixture["expectedFamily"] | null; recommendedFamily: string | null; selectedFamily: string | null; eligibility: string };

export default function BetaTestClient() {
  const [fixture, setFixture] = useState<BetaFixture | null>(null);
  const [familyDiagnostic, setFamilyDiagnostic] = useState<BetaFamilyDiagnostic>({ expectedFamily: null, recommendedFamily: null, selectedFamily: null, eligibility: "Not evaluated" });
  const [summary, setSummary] = useState({ companyName: "None", companyType: "—", persistedProjects: 0, generatedEvidence: false, imageState: "none", generatedProfile: false });
  useEffect(() => {
    const refresh = () => {
      const rawCompany = localStorage.getItem("companyData"); const rawProjects = localStorage.getItem("projectsData"); const generated = readPersistedGeneratedProfile(localStorage);
      let company: { name?: string; companyType?: string } = {}; let projects: { imageUrl?: string }[] = [];
      try { company = rawCompany ? JSON.parse(rawCompany) : {}; } catch { company = {}; }
      try { const parsed = rawProjects ? JSON.parse(rawProjects) : []; projects = Array.isArray(parsed) ? parsed : []; } catch { projects = []; }
      setSummary({ companyName: company.name || "None", companyType: company.companyType || "—", persistedProjects: projects.length, generatedEvidence: generated ? generatedProjectEvidenceCount(generated) > 0 : false, imageState: betaFixtureImageState(projects), generatedProfile: Boolean(generated) });
    };
    const initialRefresh = window.setTimeout(refresh, 0); window.addEventListener("beta-test-state-changed", refresh);
    return () => { window.clearTimeout(initialRefresh); window.removeEventListener("beta-test-state-changed", refresh); };
  }, []);
  const load = (id: BetaFixtureId) => { const next = createBetaFixture(id, createProjectImage()); loadBetaFixture(localStorage, next); const choices = familyChoices({ projectCount: next.projects.length, authenticProjectImageCount: next.projects.filter((p) => Boolean(p.imageUrl)).length, serviceCount: next.generatedProfile.sections.find((s) => s.id === "services")?.items.length ?? 0, productFeatureCount: next.generatedProfile.sections.find((s) => s.id === "features")?.items.length ?? 0, useCaseCount: next.generatedProfile.sections.find((s) => s.id === "useCases")?.items.length ?? 0 }); const recommended = choices.find((choice) => choice.recommended)?.id ?? null; const selected = localStorage.getItem("authoredFamilyDecision"); const eligibility = choices.map((choice) => `${choice.id}: ${choice.eligible ? "eligible" : `ineligible (${choice.reason})`}`).join("; "); setFamilyDiagnostic({ expectedFamily: next.expectedFamily, recommendedFamily: recommended, selectedFamily: selected, eligibility }); console.info("[beta-family-diagnostic]", { expectedFamily: next.expectedFamily, recommendedFamily: recommended, selectedFamily: selected, eligibility, brandKitPresent: Boolean(next.company.logoUrl || next.company.brandColor), contactFieldsPresent: [next.company.website, next.company.email, next.company.phone, next.company.address, next.company.socialUrl].some(Boolean) }); setFixture(next); window.dispatchEvent(new Event("beta-test-state-changed")); };
  const clear = () => { clearApplicationLocalData(localStorage); setFixture(null); setFamilyDiagnostic({ expectedFamily: null, recommendedFamily: null, selectedFamily: null, eligibility: "Not evaluated" }); window.dispatchEvent(new Event("beta-test-state-changed")); };
  return <main className="min-h-screen bg-gray-50 p-4 sm:p-8"><div className="mx-auto max-w-4xl space-y-6">
    <div className="rounded-2xl bg-white p-6 shadow-sm"><span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900">Preview QA only</span><h1 className="mt-4 text-3xl font-bold text-gray-950">Beta QA Harness</h1><p className="mt-2 text-sm text-gray-600">Load deterministic local state, then validate through the unchanged production company, generation, and export paths.</p></div>
    <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-gray-950">Positive scenarios</h2><div className="mt-4 flex flex-wrap gap-3"><button className={buttonClass} onClick={() => load("aurelia")}>Load Aurelia</button><button className={buttonClass} onClick={() => load("northbridge")}>Load Northbridge</button><button className={buttonClass} onClick={() => load("winx")}>Load WinX</button></div></section>
    <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-gray-950">Safety scenarios</h2><div className="mt-4 flex flex-wrap gap-3"><button className={buttonClass} onClick={() => load("aurelia-missing-image")}>Load missing-image case</button><button className={buttonClass} onClick={() => load("aurelia-generated-only")}>Load generated-only project case</button><button className={buttonClass} onClick={() => load("legacy-control")}>Load approved legacy fallback case</button></div></section>
    <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-gray-950">Current test state</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">{[["Company name", summary.companyName],["Company type", summary.companyType],["Persisted project count", String(summary.persistedProjects)],["Generated project evidence", summary.generatedEvidence ? "Yes" : "No"],["Project image state", summary.imageState],["Generated profile present", summary.generatedProfile ? "Yes" : "No"],["Expected family", familyDiagnostic.expectedFamily ?? "Not identified"],["Recommended family", familyDiagnostic.recommendedFamily ?? "Not identified"],["Selected family", familyDiagnostic.selectedFamily ?? "None"],["Eligibility state", familyDiagnostic.eligibility],["Expected outcome", fixture?.expectedSafetyOutcome ?? "Load a preset to display its expectation."]].map(([term, value]) => <div key={term} className="rounded-lg bg-gray-50 p-3"><dt className="font-medium text-gray-500">{term}</dt><dd className="mt-1 text-gray-950">{value}</dd></div>)}</dl></section>
    <section className="rounded-2xl bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold text-gray-950">Actions</h2><div className="mt-4 flex flex-wrap gap-3"><Link className={secondaryClass} href="/company">Open Company Data</Link><Link className={secondaryClass} href="/generate">Open Generate Profile</Link><button className={secondaryClass} onClick={clear}>Clear test state</button></div></section>
  </div></main>;
}
