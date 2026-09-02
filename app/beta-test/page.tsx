import { isBetaTestModeEnabled } from "@/lib/beta-test-mode";
import BetaTestClient from "./beta-test-client";

export default function BetaTestPage() {
  if (!isBetaTestModeEnabled(process.env.NEXT_PUBLIC_BETA_TEST_MODE)) {
    return <main className="min-h-screen bg-gray-50 p-8"><div className="mx-auto max-w-2xl rounded-xl border border-gray-200 bg-white p-8"><p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Unavailable</p><h1 className="mt-3 text-2xl font-semibold text-gray-900">This page is not available.</h1></div></main>;
  }
  return <BetaTestClient />;
}
