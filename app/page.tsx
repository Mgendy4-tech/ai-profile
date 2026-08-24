'use client';

import Link from "next/link";
import { useEffect, useState } from "react";

const defaultTitle = "AI Company Profile";

export default function Home() {
  const [companyName, setCompanyName] = useState("");

  useEffect(() => {
    const loadCompanyName = () => {
      try {
        const savedCompanyData = localStorage.getItem("companyData");

        if (!savedCompanyData) {
          return;
        }

        const parsedCompanyData = JSON.parse(savedCompanyData) as {
          name?: unknown;
        };

        if (typeof parsedCompanyData.name === "string" && parsedCompanyData.name.trim()) {
          setCompanyName(parsedCompanyData.name.trim());
        }
      } catch {
        setCompanyName("");
      }

    };

    const loadTimeout = window.setTimeout(loadCompanyName, 0);

    return () => window.clearTimeout(loadTimeout);
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-4xl font-bold text-gray-900">
          {companyName ? `${companyName} AI Profile` : defaultTitle}
        </h1>

        <p className="mt-3 text-lg text-gray-600">
          Build and update your company profile with AI.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">

          <Link href="/company" className="block h-full cursor-pointer">
            <div className="h-full rounded-xl bg-white p-6 shadow transition hover:shadow-lg">
              <h2 className="text-xl font-semibold">
                Company
              </h2>

              <p className="mt-2 text-gray-600">
                Add your company information.
              </p>
            </div>
          </Link>

          {companyName && (
            <Link href="/generate" className="block h-full cursor-pointer">
            <div className="h-full rounded-xl bg-white p-6 shadow transition hover:shadow-lg">
              <h2 className="text-xl font-semibold">
                Generate Profile
              </h2>

              <p className="mt-2 text-gray-600">
                Let AI create your professional profile.
              </p>
            </div>
            </Link>
          )}

        </div>
      </div>
    </main>
  );
}