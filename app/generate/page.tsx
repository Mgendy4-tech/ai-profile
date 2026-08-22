"use client";

import Link from "next/link";
import jsPDF from "jspdf";
import { useState } from "react";

type CompanyData = {
  name: string;
  logoUrl?: string;
  about: string;
  activities: string;
  experience: string;
};

type Project = {
  name: string;
  description: string;
  imageUrl?: string;
};

type GeneratedProfile = {
  companyName: string;
  logoUrl?: string;
  companyType: string;
  sections: GeneratedSection[];

  // Legacy fields - keep temporarily
  about: string;
  expertise: string[];
  experience: string;
  projects: Project[];
  reasons: string[];
};

type GeneratedSection = {
  id: string;
  title: string;
  description: string;
  content: string;
  items: {
    name: string;
    description: string;
    imageUrl?: string;
  }[];
};

type ProfileSection = {
  id: string;
  displayTitle: string;
  description: string;
};

type ProfileStructure = {
  companyType: string;
  recommendedSections: ProfileSection[];
};

const polishProjectDescription = (description: string) => {
  const sentences = description
    .trim()
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, 3);

  return sentences
    .map((sentence) => /[.!?]$/.test(sentence) ? sentence : `${sentence}.`)
    .join(" ");
};

const getProjectDescription = (project: Project) => {
  const projectName = project.name.toLowerCase();

  if (projectName.includes("new cairo") && projectName.includes("villa")) {
    return "Premium marble and granite supply and installation for a luxury residential villa in New Cairo, covering flooring, stairs, wall cladding, kitchens and bathrooms with a focus on quality materials and precise finishing.";
  }

  if (projectName.includes("luxury residential")) {
    return "Complete marble and granite works for a high-end residential project, including flooring, stairs, countertops and decorative applications, with emphasis on premium materials and precise installation.";
  }

  if (projectName.includes("commercial") || projectName.includes("construction")) {
    return "Marble and granite supply and installation for commercial and construction applications, delivering durable materials, accurate installation and professional finishing tailored to project requirements.";
  }

  return polishProjectDescription(project.description);
};

const loadPdfImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load project image"));
    image.src = src;
  });

const getPdfImageSource = (image: HTMLImageElement) => {
  if (!image.naturalWidth || !image.naturalHeight) {
  throw new Error("Invalid image dimensions");
}

  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  canvas.getContext("2d")?.drawImage(image, 0, 0);
  return canvas.toDataURL("image/png");
};

export default function GeneratePage() {
  const [profile, setProfile] = useState<GeneratedProfile | null>(null);
const [profileStructure, setProfileStructure] =
  useState<ProfileStructure | null>(null);
const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
const [structureConfirmed, setStructureConfirmed] = useState(false);
const [loading, setLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [exportMessage, setExportMessage] = useState("");
const handleAnalyze = async () => {
  setLoading(true);
  setErrorMessage("");

  try {
    const savedCompanyData = localStorage.getItem("companyData");
    const savedProjectsData = localStorage.getItem("projectsData");

    if (!savedCompanyData) {
      throw new Error("Please save your company information first.");
    }

    const companyData = JSON.parse(savedCompanyData) as CompanyData;

    if (!companyData.name?.trim() || !companyData.about?.trim()) {
      throw new Error("Please complete your company information first.");
    }

    const projects = savedProjectsData
      ? (JSON.parse(savedProjectsData) as Project[]).filter(
          (project) =>
            project.name?.trim() && project.description?.trim(),
        )
      : [];

    const response = await fetch("/api/analyze-structure", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        company: companyData,
        projects: projects.map(({ imageUrl, ...project }) => project),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to analyze company structure.");
    }

    setProfileStructure(data);
setSelectedSectionIds(
  data.recommendedSections.map((section: ProfileSection) => section.id)
);
setStructureConfirmed(false);
    localStorage.setItem(
  "profileStructure",
  JSON.stringify({
    companyData,
    analysis: data,
    selectedSections: data.recommendedSections,
  }),
);
  } catch (error) {
    setErrorMessage(
      error instanceof Error
        ? error.message
        : "Failed to analyze company structure.",
    );
  } finally {
    setLoading(false);
  }
};
  const handleGenerate = () => {
    setLoading(true);
    setErrorMessage("");
    setCopyMessage("");

    window.setTimeout(async() => {
      try {
        const savedCompanyData = localStorage.getItem("companyData");
        const savedProjectsData = localStorage.getItem("projectsData");

        if (!savedCompanyData) {
          setProfile(null);
          setErrorMessage("Please save your company information before generating a profile.");
          return;
        }

        const companyData = JSON.parse(savedCompanyData) as CompanyData;
        if (!companyData.name?.trim() || !companyData.about?.trim()) {
          setProfile(null);
          setErrorMessage("Please complete your company information before generating a profile.");
          return;
        }
const savedStructure = localStorage.getItem("profileStructure");

if (!savedStructure) {
  setProfile(null);
  setErrorMessage("Please analyze the company structure before generating the profile.");
  return;
}

const structure = JSON.parse(savedStructure);

const selectedSections =
  structure.analysis?.recommendedSections?.filter(
    (section: ProfileSection) =>
      selectedSectionIds.includes(section.id)
  ) || [];
          const projects = savedProjectsData
          ? (JSON.parse(savedProjectsData) as Project[]).filter(
              (project) => project.name?.trim() && project.description?.trim(),
            ).map((project) => ({
              ...project,
              description: getProjectDescription(project),
            }))
          : [];
        const expertise = [
          "Marble & Granite Supply",
          "Marble & Granite Installation",
          "Construction Projects",
        ];
        const about = companyData.about.trim().replace(/\s+/g, " ");
        const reasons = [
          "24 years of practical experience in marble and granite works.",
          "Proven experience across residential, commercial and construction projects.",
          "Commitment to quality materials and precise workmanship.",
          "Professional execution tailored to each project's requirements.",
        ];
const response = await fetch("/api/generate-profile", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
  company: {
    name: companyData.name,
    about: companyData.about,
    activities: companyData.activities,
    experience: companyData.experience,
  },

  selectedSections,

  projects: projects.map(({ imageUrl, ...project }) => project),
}),
});

const data = await response.json();

if (!response.ok) {
  throw new Error(data.error || "Failed to generate profile.");
}

setProfile({
  companyName: companyData.name.trim(),
  logoUrl: companyData.logoUrl,

  companyType: data.companyType,
  sections: (data.sections || []).map((section: GeneratedSection) => ({
    ...section,
    items: (section.items || []).map((item: GeneratedSection["items"][number]) => ({
      ...item,
      imageUrl:
        projects.find((project) => project.name === item.name)?.imageUrl,
    })),
  })),

  // Keep old fields temporarily so the existing preview/PDF still works
  about:
    data.sections?.find((section: GeneratedSection) => section.id === "about")
      ?.content || "",

  expertise: data.sections
    ?.find((section: GeneratedSection) => section.id === "expertise")
    ?.items?.map(
  (item: GeneratedSection["items"][number]) => item.name
) || [],

  experience:
    data.sections?.find(
      (section: GeneratedSection) => section.id === "experience",
    )?.content || "",

  projects: (data.sections?.find(
    (section: GeneratedSection) => section.id === "projects",
  )?.items || []).map((item: GeneratedSection["items"][number]) => ({
    name: item.name,
    description: item.description,
    imageUrl: projects.find((project) => project.name === item.name)?.imageUrl,
  })),

  reasons:
    data.sections
      ?.find((section: GeneratedSection) => section.id === "whyChoose")
      ?.items?.map(
  (item: GeneratedSection["items"][number]) => item.name
) || [],
});

      } catch {
        setProfile(null);
        setErrorMessage("We could not read the saved company information. Please save it again and try again.");
      } finally {
        setLoading(false);
      }
    }, 400);
  };

  const getProfileText = () => {
    if (!profile) {
      return "";
    }

    return [
      "ABOUT US",
      profile.about,
      "OUR EXPERTISE",
      profile.expertise.map((item) => `- ${item}`).join("\n"),
      "OUR EXPERIENCE",
      profile.experience,
      "FEATURED PROJECTS",
      profile.projects.length
        ? profile.projects
            .map((project) => `${project.name}\n${project.description}`)
            .join("\n\n")
        : "No projects have been added yet.",
      "WHY CHOOSE US",
      profile.reasons.map((reason) => `- ${reason}`).join("\n"),
    ].join("\n\n");
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getProfileText());
      setCopyMessage("Profile copied.");
    } catch {
      setCopyMessage("Unable to copy the profile.");
    }
  };

  const handleExportPdf = async () => {
    if (!profile || isExporting) {
      return;
    }

    setIsExporting(true);
    setExportMessage("");

    try {
      const pdf = new jsPDF({ unit: "mm", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - margin * 2;
      const bottomMargin = 16;
      let y = 20;
      const logo = profile.logoUrl ? await loadPdfImage(profile.logoUrl) : null;
      const logoSource = logo && profile.logoUrl
        ? await getPdfImageSource(logo)
        : null;

      const addHeader = () => {
        pdf.setTextColor(17, 24, 39);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(9);
        pdf.text(profile.companyName, margin, 11);
        if (logo && logoSource) {
          const maxLogoWidth = 24;
          const maxLogoHeight = 9;
          const logoRatio = logo.naturalWidth / logo.naturalHeight;
          const logoHeight = Math.min(maxLogoHeight, maxLogoWidth / logoRatio);
          const logoWidth = logoHeight * logoRatio;
          pdf.addImage(logoSource, pageWidth - margin - logoWidth, 4, logoWidth, logoHeight);
        }
        pdf.setDrawColor(209, 213, 219);
        pdf.line(margin, 14, pageWidth - margin, 14);
      };

      const startNewPage = () => {
        pdf.addPage();
        addHeader();
        y = 20;
      };

      const ensureSpace = (height: number) => {
        if (y + height > pageHeight - bottomMargin) {
          startNewPage();
        }
      };

      const addSectionHeading = (heading: string) => {
        ensureSpace(18);

        pdf.setTextColor(17, 24, 39);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(15);
        pdf.text(heading, margin, y);
        pdf.setDrawColor(17, 24, 39);
        pdf.line(margin, y + 3, margin + 14, y + 3);
        y += 8;
      };

      const addBodyText = (text: string, size = 10, lineHeight = 5.5) => {
        pdf.setTextColor(55, 65, 81);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(size);
        const lines = pdf.splitTextToSize(text, contentWidth) as string[];
        const height = lines.length * lineHeight;

        ensureSpace(height + 2);

        pdf.text(lines, margin, y);
        y += height + 2;
      };

      addHeader();
      pdf.setTextColor(17, 24, 39);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(25);
      pdf.text("Company Profile", margin, y + 8);
      y += 21;

      addSectionHeading("About Us");
      addBodyText(profile.about, 11, 6.5);

      addSectionHeading("Our Expertise");
      profile.expertise.forEach((item) => addBodyText(`- ${item}`, 10, 5.5));

      addSectionHeading("Our Experience");
      addBodyText(profile.experience, 11, 6.5);

      addSectionHeading("Featured Projects");
      const projectColumnWidth = (contentWidth - 6) / 2;
      const loadedProjects = await Promise.all(
        profile.projects.map(async (project) => ({
          project,
          image: project.imageUrl ? await loadPdfImage(project.imageUrl) : null,
        })),
      );

      for (let index = 0; index < loadedProjects.length; index += 2) {
        const rowProjects = loadedProjects.slice(index, index + 2);
        const isSingleProjectRow = rowProjects.length === 1;
        const cardWidth = isSingleProjectRow ? contentWidth : projectColumnWidth;
        const imageWidth = cardWidth - 10;
        const imageHeights = rowProjects.map(({ image }) => {
          if (!image) {
            return 0;
          }

          const maxImageHeight = isSingleProjectRow ? 62 : 62;
          return Math.min(maxImageHeight, imageWidth / (image.naturalWidth / image.naturalHeight));
        });
        const cardHeights = rowProjects.map(({ project }, projectIndex) => {
            const titleLines = pdf.splitTextToSize(project.name, cardWidth - 10) as string[];
            const descriptionLines = pdf.splitTextToSize(project.description, cardWidth - 6) as string[];
            return (imageHeights[projectIndex] || 0) + titleLines.length * 5 + descriptionLines.length * 4.5 + 19;
          });
        const rowHeight = Math.max(...cardHeights);

        ensureSpace(rowHeight);
        rowProjects.forEach(({ project, image }, columnIndex) => {
          const cardX = isSingleProjectRow ? margin : margin + columnIndex * (projectColumnWidth + 6);
          const titleLines = pdf.splitTextToSize(project.name, cardWidth - 10) as string[];
          const descriptionLines = pdf.splitTextToSize(project.description, cardWidth - 6) as string[];
          const projectImageHeight = imageHeights[columnIndex];
          const cardHeight = isSingleProjectRow ? cardHeights[columnIndex] + 8 : rowHeight + 8;

          pdf.setFillColor(249, 250, 251);
          pdf.setDrawColor(229, 231, 235);
          pdf.roundedRect(cardX, y, cardWidth, cardHeight, 3, 3, "FD");

          const imageX = cardX + 5;
          const imageY = y + 5;
          const imageAreaHeight = projectImageHeight || 0;

          if (image) {
  const imageSource = getPdfImageSource(image);

  const imageRatio = image.naturalWidth / image.naturalHeight;
  const renderedHeight = Math.min(
    isSingleProjectRow ? 62 : 52,
    imageWidth / imageRatio
  );
  const renderedWidth = renderedHeight * imageRatio;

  pdf.addImage(
    imageSource,
    imageX + (imageWidth - renderedWidth) / 2,
    imageY,
    renderedWidth,
    renderedHeight
  );
}

          pdf.setTextColor(17, 24, 39);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10.5);
          pdf.text(titleLines, cardX + 5, y + imageAreaHeight + 12);
          pdf.setTextColor(55, 65, 81);
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.text(descriptionLines, cardX + 3, y + imageAreaHeight + 12 + titleLines.length * 5 + 2);
        });
        y += rowHeight + 9;
      }

      y += 12;
      addSectionHeading("Why Choose Us");
      const reasonColumnWidth = (contentWidth - 6) / 2;
      const reasonRows = Math.ceil(profile.reasons.length / 2);
      const reasonHeights = profile.reasons.map((reason) => {
        const lines = pdf.splitTextToSize(reason, reasonColumnWidth - 14) as string[];
        return lines.length * 4.5 + 14;
      });
      const reasonRowHeights = Array.from({ length: reasonRows }, (_, rowIndex) =>
        Math.max(...reasonHeights.slice(rowIndex * 2, rowIndex * 2 + 2)),
      );
      ensureSpace(reasonRowHeights.reduce((total, height) => total + height, 0) + (reasonRows - 1) * 4);
      profile.reasons.forEach((reason, index) => {
        const columnIndex = index % 2;
        const rowIndex = Math.floor(index / 2);
        const cardX = margin + columnIndex * (reasonColumnWidth + 6);
        const cardY = y + reasonRowHeights.slice(0, rowIndex).reduce((total, height) => total + height + 4, 0);
        const lines = pdf.splitTextToSize(reason, reasonColumnWidth - 14) as string[];

        pdf.setFillColor(249, 250, 251);
        pdf.setDrawColor(229, 231, 235);
        pdf.roundedRect(cardX, cardY, reasonColumnWidth, reasonHeights[rowIndex], 3, 3, "FD");
        pdf.setFillColor(17, 24, 39);
        pdf.circle(cardX + 7, cardY + 8, 1.2, "F");
        pdf.setTextColor(55, 65, 81);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.text(lines, cardX + 12, cardY + 8);
      });
      y += reasonRowHeights.reduce((total, height) => total + height, 0) + (reasonRows - 1) * 4;

      const totalPages = pdf.getNumberOfPages();
      for (let pageNumber = 1; pageNumber <= totalPages; pageNumber += 1) {
        pdf.setPage(pageNumber);
        pdf.setDrawColor(209, 213, 219);
        pdf.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
        pdf.setTextColor(107, 114, 128);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text(profile.companyName, margin, pageHeight - 8);
        pdf.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
      }

      pdf.save(`${profile.companyName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "company-profile"}.pdf`);
      setExportMessage("PDF downloaded successfully.");
    } catch {
      setExportMessage("We could not create the PDF. Please check that all project images are still available and try again.");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900">
          Generate Company Profile
        </h1>

        <p className="mt-3 max-w-2xl text-gray-600">
          Let AI create your professional company profile.
        </p>

        <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900">
            AI Profile Generator
          </h2>

          <p className="mt-3 max-w-2xl leading-7 text-gray-600">
            Your company information and projects will be used to create a
            professional profile.
          </p>
<button
  type="button"
  onClick={handleAnalyze}
  disabled={loading}
  className="mt-8 mr-3 rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-900 transition hover:border-gray-900 disabled:cursor-wait disabled:opacity-60"
>
  {loading ? "Analyzing..." : "Analyze Company"}
</button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="mt-8 rounded-lg bg-black px-6 py-3 font-medium text-white transition hover:bg-gray-800 disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? "Generating..." : "Generate Profile"}
          </button>
{profileStructure && (
  <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-5">
    <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">
      We’ve tailored your profile structure
    </p>

    <h3 className="mt-2 text-xl font-semibold text-gray-900">
      {profileStructure.companyType}
    </h3>

    <div className="mt-5 space-y-3">
      {profileStructure.recommendedSections.map((section) => {
  const isSelected = selectedSectionIds.includes(section.id);

  return (
    <label
      key={section.id}
      className="flex cursor-pointer gap-3 rounded-lg border border-gray-200 bg-white p-4 transition hover:border-gray-400"
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => {
          setSelectedSectionIds((current) =>
            current.includes(section.id)
              ? current.filter((id) => id !== section.id)
              : [...current, section.id],
          );
        }}
        className="mt-1 h-4 w-4"
      />

      <div>
        <p className="font-medium text-gray-900">
          {section.displayTitle}
        </p>

        <p className="mt-1 text-sm leading-6 text-gray-600">
          {section.description}
        </p>
      </div>
    </label>
  );
})}
<div className="mt-5 flex justify-end">
  <button
    type="button"
    onClick={() => {
      setErrorMessage("");
      setStructureConfirmed(true);
    }}
    className="rounded-lg bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-gray-800"
  >
    {structureConfirmed
      ? "✓ Structure Confirmed"
      : "✓ This Looks Good"}
  </button>
</div>

    </div>
  </div>
)}
          {errorMessage && (
            <p className="mt-6 text-sm text-red-600">{errorMessage}</p>
          )}

          {profile && (
            <div className="mt-10 overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 shadow-inner">
              <div className="flex flex-col gap-5 border-b border-gray-200 bg-white px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-7">
                <div>
                  <div className="flex items-center gap-4">
                    {profile.logoUrl && (
                      <img
                        src={profile.logoUrl}
                        alt={`${profile.companyName} logo`}
                        className="h-12 w-20 rounded-lg border border-gray-200 bg-white object-contain p-1"
                      />
                    )}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                        Company Profile
                      </p>
                      <h3 className="mt-2 text-3xl font-semibold tracking-tight text-gray-900">
                        {profile.companyName}
                      </h3>
                    </div>
                  </div>
                  <div className="mt-3 h-1 w-14 rounded-full bg-gray-900" />
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:border-gray-900 hover:bg-gray-50"
                  >
                    {copyMessage ? "Copied!" : "Copy Profile"}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPdf}
                    disabled={isExporting}
                    className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isExporting ? "Exporting..." : "Download PDF"}
                  </button>
                </div>
              </div>

              <section className="space-y-10 px-5 py-7 text-gray-700 sm:px-7 sm:py-9">
  {profile.sections?.map((section) => (
    <div key={section.id} className="max-w-4xl">
      <h4 className="text-xl font-semibold tracking-tight text-gray-900">
        {section.title}
      </h4>

      <div className="mt-3 h-px w-12 bg-gray-900" />

      {section.content && (
        <p className="mt-4 text-base leading-8">
          {section.content}
        </p>
      )}

      {section.items?.length > 0 && (
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {section.items.map((item, index) => (
            <article
              key={`${item.name}-${index}`}
              className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-64 w-full bg-gray-100 object-contain object-center"
                />
              )}

              <div className="p-5">
                <h5 className="font-semibold text-gray-900">
                  {item.name}
                </h5>

                {item.description && (
                  <p className="mt-3 text-sm leading-7">
                    {item.description}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  ))}
</section>

{copyMessage && (
  <p className="px-5 py-3 text-sm text-green-600">
    {copyMessage}
  </p>
)}              {exportMessage && <p className="px-5 pt-3 text-sm text-green-600 sm:px-7">{exportMessage}</p>}

              <div className="mt-8 flex flex-wrap gap-3 border-t border-gray-200 px-5 pb-7 pt-6 sm:px-7">
                <Link href="/company" className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800">
                  Edit Company Data
                </Link>
                <Link href="/projects" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:border-gray-900 hover:bg-gray-50">
                  Edit Projects
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}