import { AuthPanel } from "./auth-shell";
import LnkditHeader from "@/app/components/lnkdit-header";

export default function AuthPage() {
  return <main className="min-h-screen bg-gray-50 px-4 py-12 sm:px-8"><div className="mx-auto max-w-3xl"><LnkditHeader/><p className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">Account access</p><h1 className="mt-3 text-4xl font-bold text-gray-900">Sign in or create your LNKDIT account</h1><p className="mt-3 max-w-2xl text-gray-600">Create a private workspace for your company profile, projects, and images. Existing local workspace data stays in this browser until authentication succeeds.</p><div className="mt-8"><AuthPanel expanded /></div></div></main>;
}
