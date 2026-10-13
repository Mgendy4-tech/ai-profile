import { AuthPanel } from "./auth-shell";
import LnkditWordmark from "@/app/components/lnkdit-wordmark";

export default function AuthPage() {
  return <main className="min-h-screen bg-gray-50 px-4 py-12 sm:px-8"><div className="mx-auto max-w-3xl"><LnkditWordmark/><p className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">Account access</p><h1 className="mt-3 text-4xl font-bold text-gray-900">Sign in to LNKDIT</h1><p className="mt-3 max-w-2xl text-gray-600">Sync your workspace privately across browsers and devices. Your existing guest workspace stays local until authentication succeeds.</p><div className="mt-8"><AuthPanel expanded /></div></div></main>;
}
