import { AuthPanel } from "./auth-shell";

export default function AuthPage() {
  return <main className="min-h-screen bg-gray-50 px-4 py-12 sm:px-8"><div className="mx-auto max-w-3xl"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-gray-500">Account access</p><h1 className="mt-3 text-4xl font-bold text-gray-900">Sign in to sync your workspace</h1><p className="mt-3 max-w-2xl text-gray-600">Your existing guest workspace stays local until authentication succeeds. After sign-in, migration is one-time and retry-safe.</p><div className="mt-8"><AuthPanel expanded /></div></div></main>;
}
