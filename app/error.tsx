"use client";

import { useEffect } from "react";
import Link from "next/link";
import { reportClientFailure } from "@/lib/client-observability";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientFailure({ category: "client_runtime_error", code: "route_error_boundary", surface: "route" });
  }, []);
  return <main className="min-h-screen bg-gray-50 px-4 py-16 sm:px-8"><div className="mx-auto max-w-xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-bold text-gray-900">We hit a temporary problem</h1><p className="mt-3 text-sm leading-6 text-gray-600">Your saved workspace is safe. Try this page again, or return to your workspace.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button type="button" onClick={() => reset()} className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">Try again</button><Link href="/" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900">Return home</Link></div></div></main>;
}
