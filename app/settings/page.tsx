import Link from "next/link";
import { AuthPanel } from "@/app/auth/auth-shell";

export default function SettingsPage() {
  return <main className="min-h-screen bg-gray-50 px-4 py-12 sm:px-8"><div className="mx-auto max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">Account</p><h1 className="mt-3 text-4xl font-bold text-gray-900">Account settings</h1><p className="mt-3 max-w-2xl text-gray-600">Manage sign-in, private workspace sync, and recovery from one place.</p><div className="mt-8"><AuthPanel expanded /></div><nav aria-label="Account information" className="mt-6 flex flex-wrap gap-4 text-sm font-medium text-gray-900"><Link href="/privacy" className="underline">Privacy</Link><Link href="/terms" className="underline">Terms</Link><Link href="/workspace" className="underline">Back to workspace</Link></nav></div></main>;
}
