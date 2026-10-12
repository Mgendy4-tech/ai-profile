"use client";

import { useEffect } from "react";
import { reportClientFailure } from "@/lib/client-observability";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientFailure({ category: "client_runtime_error", code: "global_error_boundary", surface: "global" });
  }, []);
  return <html lang="en"><body className="bg-gray-50"><main className="mx-auto flex min-h-screen max-w-xl items-center px-4"><div className="w-full rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm"><h1 className="text-2xl font-bold text-gray-900">We hit a temporary problem</h1><p className="mt-3 text-sm leading-6 text-gray-600">Your saved workspace is safe. Try again when ready.</p><button type="button" onClick={() => reset()} className="mt-6 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white">Try again</button></div></main></body></html>;
}
