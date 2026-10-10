import Link from "next/link";
import type { OnboardingStep } from "@/lib/onboarding-progress";

const statusLabel: Record<OnboardingStep["status"], string> = { ready: "Ready", "needs-attention": "Needs attention", "not-generated": "Not generated" };

export default function OnboardingProgress({ steps, nextHref, nextLabel }: { steps: OnboardingStep[]; nextHref: string; nextLabel: string }) {
  return <section aria-label="Profile setup progress" className="mb-8 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">Your profile journey</p><p className="mt-1 text-sm text-gray-600">Complete each step to unlock a safe, exportable profile.</p></div><Link href={nextHref} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800">{nextLabel}</Link></div>
    <ol className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{steps.map((step, index) => <li key={step.id} className="rounded-xl border border-gray-200 p-3"><div className="flex items-center gap-2"><span aria-hidden="true" className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-700">{index + 1}</span><span className="font-semibold text-gray-900">{step.label}</span></div><p className="mt-2 text-xs font-semibold text-gray-700">{statusLabel[step.status]}</p><p className="mt-1 text-xs leading-5 text-gray-600">{step.detail}</p></li>)}</ol>
  </section>;
}
