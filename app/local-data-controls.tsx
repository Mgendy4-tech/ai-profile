"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearApplicationLocalData } from "@/lib/local-profile-data";

export default function LocalDataControls() {
  const router = useRouter(); const [confirming, setConfirming] = useState(false);
  const clear = () => { const result = clearApplicationLocalData(window.localStorage); if (!result.complete) return; setConfirming(false); router.replace("/"); router.refresh(); };
  return <aside aria-label="Browser data notice" className="border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
      <p>Your private account workspace syncs company details, profile drafts, logos, and project images across devices. This control clears only the local copy in this browser.</p>
      {!confirming ? <button type="button" onClick={() => setConfirming(true)} className="shrink-0 rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-800">Clear local data</button> : <div role="group" aria-label="Confirm clearing local data" className="flex items-center gap-2"><span className="text-red-700">Delete all saved profile data from this browser?</span><button type="button" onClick={clear} className="rounded-md bg-red-700 px-3 py-1.5 font-medium text-white">Yes, clear it</button><button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-gray-300 px-3 py-1.5">Cancel</button></div>}
    </div>
  </aside>;
}
