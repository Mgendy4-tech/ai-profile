'use client';

import { useEffect, useState } from "react";
import { readApplicationStorage } from "@/lib/local-profile-data";
import { readWorkspace, workspaceStatus } from "@/lib/workspace";
import HomepageShowcase from "@/app/components/homepage-showcase";

export default function Home() {
  const [companyName, setCompanyName] = useState("");
  const [resumeHref, setResumeHref] = useState("/company");

  useEffect(() => {
    const loadCompanyName = () => {
      try {
        const savedCompanyData = readApplicationStorage(localStorage, "companyData");

        if (!savedCompanyData) {
          return;
        }

        const parsedCompanyData = JSON.parse(savedCompanyData) as {
          name?: unknown;
        };

        if (typeof parsedCompanyData.name === "string" && parsedCompanyData.name.trim()) {
          setCompanyName(parsedCompanyData.name.trim());
          const workspace = readWorkspace(localStorage);
          const active = workspace.profiles.find((profile) => profile.id === workspace.activeProfileId) ?? workspace.profiles[0];
          setResumeHref(active && workspaceStatus(active) === "Ready to export" ? "/generate" : "/company");
        }
      } catch {
        setCompanyName("");
      }

    };

    const loadTimeout = window.setTimeout(loadCompanyName, 0);

    return () => window.clearTimeout(loadTimeout);
  }, []);

  return <HomepageShowcase companyName={companyName} resumeHref={resumeHref} />;
}
