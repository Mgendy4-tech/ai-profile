'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isolateNewCompanyState } from '@/lib/profile-state-isolation';
import { emptyCompanyData, normalizeCompanyData, type CompanyData } from '@/lib/company-data';

type Project = {
  id: string;
  name: string;
  category?: string;
  description: string;
  imageUrl: string;
};

const textFieldClass = 'mt-2 w-full rounded-lg border border-gray-300 bg-white p-3 text-gray-950 placeholder:text-gray-400 outline-none focus:border-gray-900';

const readImageFile = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });

export default function CompanyPage() {
  const router = useRouter();
  const [companyData, setCompanyData] = useState<CompanyData>(emptyCompanyData);
  const [projectName, setProjectName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [isAddingProject, setIsAddingProject] = useState(true);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoExplicitlySelected = useRef(false);
  const explicitlyEditedFields = useRef(new Set<keyof CompanyData>());
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const loadCompanyData = () => {
      const savedCompanyData = localStorage.getItem('companyData');

      if (savedCompanyData) {
        try {
          setCompanyData(normalizeCompanyData(JSON.parse(savedCompanyData)));
        } catch {
          localStorage.removeItem('companyData');
        }
      }

    };

    const loadTimeout = window.setTimeout(loadCompanyData, 0);

    return () => window.clearTimeout(loadTimeout);
  }, []);

  useEffect(() => {
    const loadProjects = () => {
      const savedProjects = localStorage.getItem('projectsData');

      if (savedProjects) {
        try {
          const parsedProjects = JSON.parse(savedProjects);

          if (Array.isArray(parsedProjects)) {
            setProjects(parsedProjects);
            setIsAddingProject(parsedProjects.length === 0);
          }
        } catch {
          localStorage.removeItem('projectsData');
        }
      }
    };

    const loadTimeout = window.setTimeout(loadProjects, 0);

    return () => window.clearTimeout(loadTimeout);
  }, []);

  const updateField = (field: keyof CompanyData, value: string) => {
    explicitlyEditedFields.current.add(field);
    setCompanyData((currentData) => ({ ...currentData, [field]: value }));
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleLogoSelect = (file: File | undefined) => {
    if (!file) {
      return;
    }

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setErrorMessage('Please select a PNG or JPG logo file.');
      setSuccessMessage('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => { logoExplicitlySelected.current = true; updateField('logoUrl', String(reader.result)); };
    reader.onerror = () => {
      setErrorMessage('We could not read that logo. Please try another file.');
      setSuccessMessage('');
    };
    reader.readAsDataURL(file);
  };

  const handleImageSelect = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select an image file.');
      setSuccessMessage('');
      return;
    }

    try {
      const imageData = await readImageFile(file);
      setImageUrl(imageData);
      setImagePreview(imageData);
      setErrorMessage('');
      setSuccessMessage('');
    } catch {
      setErrorMessage('We could not read that image. Please try another file.');
      setSuccessMessage('');
    }
  };

  const handleEditProject = (project: Project) => {
    setEditingProjectId(project.id);
    setProjectName(project.name);
    setCategory(project.category ?? '');
    setDescription(project.description);
    setImageUrl(project.imageUrl);
    setImagePreview(project.imageUrl);
    setIsAddingProject(true);
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleProjectSubmit = () => {
    const trimmedProjectName = projectName.trim();
    const trimmedDescription = description.trim();
    const trimmedImageUrl = imageUrl.trim();

    if (!trimmedProjectName || !trimmedDescription || !trimmedImageUrl) {
      setErrorMessage('Please fill in the project name, description, and project image.');
      setSuccessMessage('');
      return;
    }

    const updatedProjects = editingProjectId
      ? projects.map((project) =>
          project.id === editingProjectId
            ? {
                ...project,
                name: trimmedProjectName,
                category: category.trim(),
                description: trimmedDescription,
                imageUrl: trimmedImageUrl,
              }
            : project,
        )
      : [
          ...projects,
          {
            id: `${Date.now()}-${projectName}`,
            name: trimmedProjectName,
            category: category.trim(),
            description: trimmedDescription,
            imageUrl: trimmedImageUrl,
          },
        ];

    setProjects(updatedProjects);
    localStorage.setItem('projectsData', JSON.stringify(updatedProjects));
    setEditingProjectId(null);
    setProjectName('');
    setCategory('');
    setDescription('');
    setImageUrl('');
    setImagePreview('');
    setIsAddingProject(false);
    setErrorMessage('');
    setSuccessMessage(editingProjectId ? 'Project updated successfully.' : 'Project saved successfully.');
  };

  const handleDeleteProject = (projectId: string) => {
    const updatedProjects = projects.filter((project) => project.id !== projectId);

    setProjects(updatedProjects);
    localStorage.setItem('projectsData', JSON.stringify(updatedProjects));
    setIsAddingProject(updatedProjects.length === 0);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !companyData.name.trim() ||
      !companyData.about.trim()
    ) {
      setErrorMessage('Please provide the company name and about information before saving.');
      setSuccessMessage('');
      return;
    }

    let previousCompany: CompanyData | null = null;
    try { previousCompany = JSON.parse(localStorage.getItem('companyData') ?? 'null') as CompanyData | null; } catch { previousCompany = null; }
    const isolated = isolateNewCompanyState(previousCompany, companyData, projects, logoExplicitlySelected.current, explicitlyEditedFields.current);
    isolated.clearKeys.forEach((key) => localStorage.removeItem(key));
    const approvedCompanyData = isolated.companyData as CompanyData;
    const approvedProjects = isolated.projects as Project[];
    setCompanyData(approvedCompanyData);
    setProjects(approvedProjects);
    localStorage.setItem('companyData', JSON.stringify(approvedCompanyData));
    localStorage.setItem('projectsData', JSON.stringify(approvedProjects));

setTimeout(() => {
  router.push('/generate');
}, 500);

    setErrorMessage('');
    setSuccessMessage('Company information saved successfully.');
  };

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900">
          Company Information
        </h1>

        <p className="mt-2 text-gray-600">
          Tell us about your company.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6 rounded-xl bg-white p-5 shadow sm:p-8">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Company Name
            </label>

            <input
              type="text"
              placeholder="e.g. ElShaarawy for Marble & Granite"
              value={companyData.name}
              onChange={(event) => updateField('name', event.target.value)}
              className={textFieldClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Company Logo
            </label>

            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg"
              onChange={(event) => handleLogoSelect(event.target.files?.[0])}
              className="mt-2 block w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:font-medium file:text-gray-900"
            />

            {companyData.logoUrl && (
              <div className="mt-4 flex flex-wrap items-end gap-3">
                <img
                  src={companyData.logoUrl}
                  alt="Company logo preview"
                  className="h-24 w-40 rounded-lg border border-gray-200 bg-white object-contain p-2"
                />
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 transition hover:border-gray-900 hover:bg-gray-50"
                >
                  Replace Logo
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              About Company
            </label>

            <textarea
              placeholder="Tell us about the company..."
              rows={5}
              value={companyData.about}
              onChange={(event) => updateField('about', event.target.value)}
              className={textFieldClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Company Type <span className="font-normal text-gray-500">(optional)</span></label>
            <input type="text" placeholder="e.g. Professional services company" value={companyData.companyType} onChange={(event) => updateField('companyType', event.target.value)} className={textFieldClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Industry <span className="font-normal text-gray-500">(optional)</span></label>
            <input type="text" placeholder="e.g. Management Consulting" value={companyData.industry} onChange={(event) => updateField('industry', event.target.value)} className={textFieldClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Customer / Client Type <span className="font-normal text-gray-500">(optional)</span></label>
            <input type="text" placeholder="e.g. B2B, consumers, public sector" value={companyData.customerType} onChange={(event) => updateField('customerType', event.target.value)} className={textFieldClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Services / Products <span className="font-normal text-gray-500">(optional)</span></label>
            <textarea rows={4} placeholder="List the services or products you actually provide..." value={companyData.servicesProducts} onChange={(event) => updateField('servicesProducts', event.target.value)} className={textFieldClass} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Main Activities <span className="font-normal text-gray-500">(optional)</span>
            </label>

            <input
              type="text"
              placeholder="e.g. Marble & Granite, Construction"
              value={companyData.activities}
              onChange={(event) => updateField('activities', event.target.value)}
              className={textFieldClass}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Years of Experience <span className="font-normal text-gray-500">(optional)</span>
            </label>

            <input
              type="number"
              placeholder="e.g. 20"
              value={companyData.experience}
              onChange={(event) => updateField('experience', event.target.value)}
              className={textFieldClass}
            />
          </div>

          <section className="flex flex-col border-t border-gray-200 pt-6">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Projects</h2>
              <p className="mt-2 text-sm text-gray-600">
                Add projects and project photos if you want to include them in your profile.
              </p>
            </div>

            {isAddingProject && (
            <div className="order-2 mt-5 rounded-xl bg-gray-50 p-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingProjectId ? 'Edit Project' : `Project #${projects.length + 1}`}
              </h3>

              <label className="mt-4 block text-sm font-medium text-gray-900">
                Project Name
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="e.g. New Cairo Marble Project"
                className={`${textFieldClass} px-4 py-3`}
              />

              <label className="mt-4 block text-sm font-medium text-gray-900">
                Project Type / Category <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <input
                type="text"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="e.g. Residential, Commercial"
                className={`${textFieldClass} px-4 py-3`}
              />

              <label className="mt-4 block text-sm font-medium text-gray-900">
                Project Description
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Describe the project..."
                rows={4}
                className={`${textFieldClass} px-4 py-3`}
              />

              <label className="mt-4 block text-sm font-medium text-gray-900">
                Project Photo <span className="font-normal text-gray-500">(required)</span>
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(event) => handleImageSelect(event.target.files?.[0])}
                className="mt-2 block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:font-medium file:text-gray-900"
              />

              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Project preview"
                  className="mt-4 h-48 w-full rounded-lg object-contain"
                />
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleProjectSubmit}
                  className="rounded-lg bg-black px-5 py-2.5 font-medium text-white"
                >
                  {editingProjectId
                    ? 'Update Project'
                    : 'Save Project'}
                </button>
                {editingProjectId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProjectId(null);
                      setProjectName('');
                      setCategory('');
                      setDescription('');
                      setImageUrl('');
                      setImagePreview('');
                    }}
                    className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-900"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
            </div>
            )}

            {projects.length > 0 && (
              <div className="order-1 mt-5 space-y-4">
                {projects.map((project) => (
                  <article key={project.id} className="rounded-xl border border-gray-200 bg-white p-4">
                    {project.imageUrl && (
                      <img
                        src={project.imageUrl}
                        alt={project.name}
                        className="h-40 w-full rounded-lg object-contain"
                      />
                    )}
                    <h3 className="mt-3 font-semibold text-gray-900">{project.name}</h3>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                      {project.description}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditProject(project)}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProject(project.id)}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {!isAddingProject && projects.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setEditingProjectId(null);
                  setProjectName('');
                  setCategory('');
                  setDescription('');
                  setImageUrl('');
                  setImagePreview('');
                  setErrorMessage('');
                  setSuccessMessage('');
                  setIsAddingProject(true);
                }}
                className="order-3 mt-5 self-start rounded-lg border border-gray-300 bg-white px-5 py-2.5 font-medium text-gray-900 transition hover:border-gray-900 hover:bg-gray-50"
              >
                Add Another Project
              </button>
            )}
          </section>

          <button type="submit" className="rounded-lg bg-black px-6 py-3 font-medium text-white">
            Save Company
          </button>

          {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
          {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}
        </form>
      </div>
    </main>
  );
}
