"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { authPathFor } from "@/lib/auth-redirect";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function AuthGatedLink({ nextHref, className, children }: { nextHref: string; className: string; children: React.ReactNode }) {
  const [href, setHref] = useState(() => authPathFor(nextHref));

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    let active = true;
    void supabase.auth.getSession().then(({ data }) => { if (active && data.session) setHref(nextHref); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (active) setHref(session ? nextHref : authPathFor(nextHref)); });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [nextHref]);

  return <Link href={href} className={className}>{children}</Link>;
}
