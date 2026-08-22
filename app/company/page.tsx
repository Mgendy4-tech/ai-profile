'use client';

import { FormEvent, useEffect, useState } from 'react';

type CompanyData = {
  name: string;
  logoUrl: string;
  about: string;
  activities: string;
  experience: string;
};

const emptyCompanyData: CompanyData = {
  name: '',
  logoUrl: '',
  about: '',
  activities: '',
  experience: '',
};

export default function CompanyPage() {
  const [companyData, setCompanyData] = useState<CompanyData>(emptyCompanyData);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const loadCompanyData = () => {
      const savedCompanyData = localStorage.getItem('companyData');

      if (savedCompanyData) {
        try {
          setCompanyData({ ...emptyCompanyData, ...JSON.parse(savedCompanyData) });
        } catch {
          localStorage.removeItem('companyData');
        }
      }

    };

    const loadTimeout = window.setTimeout(loadCompanyData, 0);

    return () => window.clearTimeout(loadTimeout);
  }, []);

  const updateField = (field: keyof CompanyData, value: string) => {
    setCompanyData((currentData) => ({ ...currentData, [field]: value }));
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleLogoSelect = (file: File | undefined) => {
    if (!file) {
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/svg+xml'].includes(file.type)) {
      setErrorMessage('Please select a PNG, JPG, or SVG logo file.');
      setSuccessMessage('');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => updateField('logoUrl', String(reader.result));
    reader.onerror = () => {
      setErrorMessage('We could not read that logo. Please try another file.');
      setSuccessMessage('');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !companyData.name.trim() ||
      !companyData.about.trim() ||
      !companyData.activities.trim() ||
      !companyData.experience.trim()
    ) {
      setErrorMessage('Please fill in all company fields before saving.');
      setSuccessMessage('');
      return;
    }

    localStorage.setItem('companyData', JSON.stringify(companyData));
    setErrorMessage('');
    setSuccessMessage('Company information saved successfully.');
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-gray-900">
          Company Information
        </h1>

        <p className="mt-2 text-gray-600">
          Tell us about your company.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6 rounded-xl bg-white p-8 shadow">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Company Name
            </label>

            <input
              type="text"
              placeholder="e.g. ElShaarawy for Marble & Granite"
              value={companyData.name}
              onChange={(event) => updateField('name', event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 p-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Company Logo
            </label>

            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              onChange={(event) => handleLogoSelect(event.target.files?.[0])}
              className="mt-2 block w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:font-medium file:text-gray-900"
            />

            {companyData.logoUrl && (
              <img
                src={companyData.logoUrl}
                alt="Company logo preview"
                className="mt-4 h-24 w-40 rounded-lg border border-gray-200 bg-white object-contain p-2"
              />
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
              className="mt-2 w-full rounded-lg border border-gray-300 p-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Main Activities
            </label>

            <input
              type="text"
              placeholder="e.g. Marble & Granite, Construction"
              value={companyData.activities}
              onChange={(event) => updateField('activities', event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 p-3"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Years of Experience
            </label>

            <input
              type="number"
              placeholder="e.g. 20"
              value={companyData.experience}
              onChange={(event) => updateField('experience', event.target.value)}
              className="mt-2 w-full rounded-lg border border-gray-300 p-3"
            />
          </div>

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
