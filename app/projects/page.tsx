"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";

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

  useEffect(() => {
    const loadProjects = () => {
      const savedProjects = localStorage.getItem("projectsData");

      if (savedProjects) {
        try {
          const parsedProjects = JSON.parse(savedProjects);

          if (Array.isArray(parsedProjects)) {
            setProjects(parsedProjects);
          }
        } catch {
          localStorage.removeItem("projectsData");
        }
      }
    };

    const loadTimeout = window.setTimeout(loadProjects, 0);

    return () => window.clearTimeout(loadTimeout);
  }, []);
const handleEdit = (project: Project) => {
  setEditingProjectId(project.id);
  setProjectName(project.name);
  setCategory(project.category ?? "");
  setDescription(project.description);
  setImageUrl(project.imageUrl);
  setImagePreview(project.imageUrl);

  setErrorMessage("");
  setSuccessMessage("");

  document.getElementById("project-name")?.focus();
};
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!projectName.trim() || !description.trim() || !imageUrl.trim()) {
      setErrorMessage("Please fill in the project name, description, and project image.");
      setSuccessMessage("");
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
        id: `${Date.now()}-${projectName}`,
        name: projectName.trim(),
        category: category.trim(),
        description: description.trim(),
        imageUrl: imageUrl.trim(),
      },
    ];

setProjects(updatedProjects);
localStorage.setItem("projectsData", JSON.stringify(updatedProjects));

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
  };

  const handleImageSelect = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select an image file.");
      setSuccessMessage("");
      return;
    }

    try {
      const imageData = await readImageFile(file);
      setImageUrl(imageData);
      setImagePreview(imageData);
      setErrorMessage("");
      setSuccessMessage("");
    } catch {
      setErrorMessage("We could not read that image. Please try another file.");
      setSuccessMessage("");
    }
  };

  const handleReplaceImage = async (projectId: string, file: File | undefined) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select an image file.");
      setSuccessMessage("");
      return;
    }

    try {
      const imageData = await readImageFile(file);
      const updatedProjects = projects.map((project) =>
        project.id === projectId ? { ...project, imageUrl: imageData } : project,
      );

      setProjects(updatedProjects);
      localStorage.setItem("projectsData", JSON.stringify(updatedProjects));
      setErrorMessage("");
      setSuccessMessage("Project image updated successfully.");
    } catch {
      setErrorMessage("We could not read that image. Please try another file.");
      setSuccessMessage("");
    }
  };

  const handleDelete = (projectId: string) => {
    const updatedProjects = projects.filter((project) => project.id !== projectId);

    setProjects(updatedProjects);
    localStorage.setItem("projectsData", JSON.stringify(updatedProjects));
  };

  const focusNewProjectForm = () => {
    document.getElementById("project-name")?.focus();
  };

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-4xl font-bold text-gray-900">
          Projects
        </h1>

        <p className="mt-2 text-gray-600">
          Add your projects and project photos.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 rounded-2xl bg-white p-8 shadow-sm">
          <div className="mb-8 border-b border-gray-200 pb-5">
            <h2 className="text-2xl font-semibold text-gray-900">
              Add New Project
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Adding Project {projects.length + 1} — Add another project to your company profile.
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-900">
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
              className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
            />
          </div>

          <div className="mt-6">
            <label className="text-sm font-medium text-gray-900">
              Project Type / Category <span className="font-normal text-gray-500">(optional)</span>
            </label>

            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Residential, Commercial"
              className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
            />
          </div>

          <div className="mt-6">
            <label className="text-sm font-medium text-gray-900">
              Project Description
            </label>

            <p className="mt-1 text-sm text-gray-500">
              Tell us briefly what you did in this project. Simple words are fine — AI will professionally rewrite it later.
            </p>

            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setErrorMessage("");
                setSuccessMessage("");
              }}
              placeholder="Describe the project..."
              rows={5}
              className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-black"
            />
          </div>

          <div className="mt-6 rounded-xl bg-gray-50 p-4">
            <label className="text-sm font-medium text-gray-900">
              Upload Project Image <span className="font-normal text-gray-500">(required)</span>
            </label>

            <input
              key={projects.length}
              type="file"
              accept="image/*"
              onChange={(event) => handleImageSelect(event.target.files?.[0])}
              className="mt-2 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:font-medium file:text-gray-900"
            />

            {imagePreview && (
              <img
                src={imagePreview}
                alt="Featured project preview"
                className="mt-4 h-48 w-full rounded-lg object-cover"
              />
            )}
          </div>

          <button
            type="submit"
            className="mt-8 rounded-lg bg-black px-6 py-3 font-medium text-white"
          >
            Save Project
          </button>

          {errorMessage && <p className="mt-4 text-sm text-red-600">{errorMessage}</p>}
          {successMessage && <p className="mt-4 text-sm text-green-600">{successMessage}</p>}
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
                {project.imageUrl && (
                  <img
                    src={project.imageUrl}
                    alt={project.name}
                    className="mb-5 h-48 w-full rounded-lg object-contain"
                  />
                )}

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
                    Replace Image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleReplaceImage(project.id, event.target.files?.[0])}
                      className="hidden"
                    />
                  </label>
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