"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { dataUrlDecodedBytes, PRODUCTION_V1_LIMITS } from "@/lib/production-limits";
import { clearDerivedProfileState, removeApplicationStorage, storageUserMessage } from "@/lib/local-profile-data";
import { persistProjects, persistedImageState, readPersistedProjects } from "@/lib/persisted-projects";
import { readPersistedCompanyData } from "@/lib/company-data";
import { readPersistedGeneratedProfile } from "@/lib/generated-profile-storage";
import OnboardingProgress from "@/app/components/onboarding-progress";
import { deriveOnboardingProgress } from "@/lib/onboarding-progress";

type Project = {
  id: string;
  name: string;
  category?: string;
  description: string;
  imageUrl: string;
};

const readImageFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read image file"));
    reader.readAsDataURL(file);
  });

const validateImageFile = async (file: File) => {
  if (!/image\/(png|jpeg)/i.test(file.type)) throw new Error("Please select a PNG or JPEG image.");
  if (file.size > PRODUCTION_V1_LIMITS.imageBytes) throw new Error("Each project image must be 3 MB or smaller.");
  const url = URL.createObjectURL(file);
  try {
    const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("The image could not be decoded."));
      image.src = url;
    });
    if (!dimensions.width || !dimensions.height || dimensions.width > PRODUCTION_V1_LIMITS.imageDimensionPx || dimensions.height > PRODUCTION_V1_LIMITS.imageDimensionPx) throw new Error("Images must decode successfully and be no larger than 12,000 pixels on either side.");
  } finally {
    URL.revokeObjectURL(url);
  }
};

export default function ProjectsPage() {
  const [projectName, setProjectName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [companyData, setCompanyData] = useState<ReturnType<typeof readPersistedCompanyData>>(null);
  const [generatedProfile, setGeneratedProfile] = useState<ReturnType<typeof readPersistedGeneratedProfile>>(null);

  useEffect(() => {
    const loadProjects = () => {
      const snapshot = readPersistedProjects(localStorage);
      if (snapshot.issues.length) { removeApplicationStorage(localStorage, "projectsData"); setErrorMessage("Saved project data could not be read. Add the project again and save it."); return; }
      setProjects(snapshot.projects);
      setCompanyData(readPersistedCompanyData(localStorage));
      setGeneratedProfile(readPersistedGeneratedProfile(localStorage));
    };

    const loadTimeout = window.setTimeout(loadProjects, 0);

    return () => window.clearTimeout(loadTimeout);
  }, []);
const handleEdit = (project: Project) => {
  setEditingProjectId(project.id);
  setProjectName(project.name);
  setCategory(project.category ?? "");
  setDescription(project.description);
  const validImage = persistedImageState(project.imageUrl) === "valid";
  setImageUrl(validImage ? project.imageUrl : "");
  setImagePreview(validImage ? project.imageUrl : "");

  setErrorMessage("");
  setSuccessMessage("");

  document.getElementById("project-name")?.focus();
};
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    setIsSaving(true);

    const trimmedProjectName = projectName.trim();
const trimmedDescription = description.trim();
const trimmedImageUrl = imageUrl.trim();

if (!trimmedProjectName || !trimmedDescription || !trimmedImageUrl) {
  setErrorMessage(
    "Please fill in the project name, description, and project image.",
  );
  setSuccessMessage("");
  setIsSaving(false);
  return;
}
if (!editingProjectId && projects.length >= PRODUCTION_V1_LIMITS.projects) {
  setErrorMessage(`V1 supports at most ${PRODUCTION_V1_LIMITS.projects} projects.`);
  setSuccessMessage("");
  setIsSaving(false);
  return;
}

    const updatedProjects = editingProjectId
  ? projects.map((project) =>
      project.id === editingProjectId
        ? {
            ...project,
            name: projectName.trim(),
            category: category.trim(),
            description: description.trim(),
            imageUrl: imageUrl.trim(),
          }
        : project,
    )
  : [
      ...projects,
      {
        id: `project:${crypto.randomUUID()}`,
        name: projectName.trim(),
        category: category.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim(),
      },
    ];

const saved = persistProjects(localStorage, updatedProjects);
if (!saved.ok) { setErrorMessage(storageUserMessage(saved.code)); setSuccessMessage(""); setIsSaving(false); return; }
setProjects(updatedProjects);
clearDerivedProfileState(localStorage);
setGeneratedProfile(null);

setEditingProjectId(null);
setProjectName("");
setCategory("");
setDescription("");
setImageUrl("");
setImagePreview("");
setErrorMessage("");
setSuccessMessage(
  editingProjectId
    ? "Project updated successfully."
    : "Project saved successfully.",
);
setIsSaving(false);
  };

  const handleImageSelect = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    try {
      await validateImageFile(file);
      const existingBytes = projects.reduce((total, project) => total + dataUrlDecodedBytes(project.imageUrl), 0);
      if (existingBytes + file.size > PRODUCTION_V1_LIMITS.browserPersistedImageBytes) throw new Error("Combined project images must be 3 MB or smaller for safe browser storage. Remove or replace an image before adding another.");
      const imageData = await readImageFile(file);
      setImageUrl(imageData);
      setImagePreview(imageData);
      setErrorMessage("");
      setSuccessMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We could not read that image. Please try another file.");
      setSuccessMessage("");
    }
  };

  const handleReplaceImage = async (projectId: string, file: File | undefined) => {
    if (!file) {
      return;
    }

    try {
      await validateImageFile(file);
      const existingBytes = projects.reduce((total, project) => total + (project.id === projectId ? 0 : dataUrlDecodedBytes(project.imageUrl)), 0);
      if (existingBytes + file.size > PRODUCTION_V1_LIMITS.browserPersistedImageBytes) throw new Error("Combined project images must be 3 MB or smaller for safe browser storage. Remove or replace another image first.");
      const imageData = await readImageFile(file);
      const updatedProjects = projects.map((project) =>
        project.id === projectId ? { ...project, imageUrl: imageData } : project,
      );

      const saved = persistProjects(localStorage, updatedProjects);
      if (!saved.ok) { setErrorMessage(storageUserMessage(saved.code)); setSuccessMessage(""); return; }
      setProjects(updatedProjects);
      clearDerivedProfileState(localStorage);
      setGeneratedProfile(null);
      setErrorMessage("");
      setSuccessMessage("Project image updated successfully.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We could not read that image. Please try another file.");
      setSuccessMessage("");
    }
  };

  const handleDelete = (projectId: string) => {
    const updatedProjects = projects.filter((project) => project.id !== projectId);

    const saved = persistProjects(localStorage, updatedProjects);
    if (!saved.ok) { setErrorMessage(storageUserMessage(saved.code)); setSuccessMessage(""); return; }
    setProjects(updatedProjects);
    clearDerivedProfileState(localStorage);
    setGeneratedProfile(null);
  };

  const focusNewProjectForm = () => {
    document.getElementById("project-name")?.focus();
  };
  const onboardingSteps = deriveOnboardingProgress({ company: companyData, projects, profile: generatedProfile });

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold text-gray-900">
          Projects
        </h1>

        <p className="mt-2 text-gray-600">
          Add a project when your work benefits from a visual portfolio. A valid project image is required for Visual / Portfolio, while service-led profiles can continue without projects.
        </p>

        <div className="mt-6"><OnboardingProgress steps={onboardingSteps} nextHref="/generate" nextLabel="Next: Generate" /></div>

        <form onSubmit={handleSubmit} className="mt-8 rounded-2xl bg-white p-5 shadow-sm sm:p-8">
          <div className="mb-8 border-b border-gray-200 pb-5">
            <h2 className="text-2xl font-semibold text-gray-900">
              Add New Project
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Adding Project {projects.length + 1} — Add another project to your company profile.
            </p>
          </div>

          <div>
            <label htmlFor="project-name" className="text-sm font-medium text-gray-900">
              Project Name
            </label>

            <input
              type="text"
              id="project-name"
              value={projectName}
              onChange={(e) => {
                setProjectName(e.target.value);
                setErrorMessage("");
                setSuccessMessage("");
              }}
              placeholder="e.g. New Cairo Marble Project"
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-950 placeholder:text-gray-400 outline-none focus:border-black"
            />
          </div>

          <div className="mt-6">
            <label htmlFor="project-category" className="text-sm font-medium text-gray-900">
              Project Type / Category <span className="font-normal text-gray-500">(optional)</span>
            </label>

            <input
              type="text"
              id="project-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Residential, Commercial"
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-950 placeholder:text-gray-400 outline-none focus:border-black"
            />
          </div>

          <div className="mt-6">
            <label htmlFor="project-description" className="text-sm font-medium text-gray-900">
              Project Description
            </label>

            <p className="mt-1 text-sm text-gray-500">
              Tell us briefly what you did in this project. Simple words are fine — AI will professionally rewrite it later.
            </p>

            <textarea
              id="project-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setErrorMessage("");
                setSuccessMessage("");
              }}
              placeholder="Describe the project..."
              rows={5}
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-950 placeholder:text-gray-400 outline-none focus:border-black"
            />
          </div>

          <div className="mt-6 rounded-xl bg-gray-50 p-4">
            <label htmlFor="project-image" className="text-sm font-medium text-gray-900">
              Upload Project Image <span className="font-normal text-gray-500">(required)</span>
            </label>
            <p className="mt-1 text-sm text-gray-600">Use an authentic image of this project. It is required for Visual / Portfolio eligibility.</p>

            <input
              key={projects.length}
              type="file"
              id="project-image"
              accept="image/png,image/jpeg"
              onChange={(event) => handleImageSelect(event.target.files?.[0])}
              className="mt-2 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:font-medium file:text-gray-900"
            />

            {imagePreview && (
              <div className="mt-4"><p className="mb-2 text-xs font-medium text-green-700">Image selected and ready to save</p><img src={imagePreview} alt="Featured project preview" className="h-48 w-full rounded-lg object-cover" /><button type="button" onClick={() => { setImageUrl(""); setImagePreview(""); }} className="mt-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-900">Remove image</button></div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSaving}
                    className="mt-8 rounded-lg bg-black px-6 py-3 font-medium text-white disabled:cursor-wait disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save Project"}
          </button>

          {errorMessage && <p role="alert" className="mt-4 text-sm text-red-600">{errorMessage}</p>}
          {successMessage && <p role="status" className="mt-4 text-sm text-green-600">{successMessage}</p>}
        </form>

        <section className="mt-8">
          <h2 className="text-2xl font-semibold text-gray-900">
            Saved Projects ({projects.length})
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Your saved projects are stored. Add another project or continue when you are finished.
          </p>

          {projects.length > 0 && (
            <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
            {projects.map((project) => (
              <article key={project.id} className="rounded-2xl bg-white p-6 shadow-sm">
                {persistedImageState(project.imageUrl) === "valid" && (
                  <img
                    src={project.imageUrl}
                    alt={project.name}
                    className="mb-5 h-48 w-full rounded-lg object-contain"
                  />
                )}

                {persistedImageState(project.imageUrl) === "valid" ? <p className="mb-3 text-xs font-semibold text-green-700">Project image ready</p> : persistedImageState(project.imageUrl) === "invalid" ? <p role="status" className="mb-3 text-sm font-medium text-amber-800">Replace this image — the saved image can’t be used.</p> : <p role="status" className="mb-3 text-sm font-medium text-amber-800">Add a real project image to unlock Visual / Portfolio.</p>}

                <h2 className="text-lg font-semibold text-gray-900">{project.name}</h2>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">{project.description}</p>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleDelete(project.id)}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
                  >
                    Delete
                  </button>
                  <button
  type="button"
  onClick={() => handleEdit(project)}
  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50"
>
  Edit
</button>
                  

                  <label className="cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50">
                    Replace image
                    <input
                      type="file"
                      accept="image/png,image/jpeg"
                      aria-label={`Replace image for ${project.name}`}
                      onChange={(event) => handleReplaceImage(project.id, event.target.files?.[0])}
                      className="hidden"
                    />
                  </label>
                  <button type="button" onClick={() => { const updated = projects.map((entry) => entry.id === project.id ? { ...entry, imageUrl: "" } : entry); const saved = persistProjects(localStorage, updated); if (!saved.ok) { setErrorMessage(storageUserMessage(saved.code)); setSuccessMessage(""); return; } setProjects(updated); clearDerivedProfileState(localStorage); setGeneratedProfile(null); setSuccessMessage("Project image removed. Visual / Portfolio now requires a new authentic image."); }} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 transition hover:bg-gray-50">Remove image</button>
                </div>
              </article>
            ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={focusNewProjectForm}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-900 transition hover:border-gray-900 hover:bg-gray-50"
            >
              + Add Another Project
            </button>

            <Link
              href="/generate"
              className="rounded-lg bg-black px-4 py-2 font-medium text-white transition hover:bg-gray-800"
            >
              Done — Continue to Company Profile →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
