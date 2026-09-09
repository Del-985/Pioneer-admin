import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext.jsx';
import { apiRequest } from '../lib/api.js';

const emptyForm = {
  name: '',
  description: '',
  category: 'general',
  version: '1',
  status: 'active',
};

const defaultCategories = ['general', 'operations', 'safety', 'customer', 'employee', 'finance', 'vehicle'];

function formFromRecord(form) {
  return {
    name: form.name || '',
    description: form.description || '',
    category: form.category || 'general',
    version: form.version || '1',
    status: form.status || 'active',
  };
}

function nullable(value) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value));
}

function formatCategory(value) {
  return String(value || 'general')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatFileSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 1) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function startDownload(url, fileName) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  if (fileName) anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function FormsPage() {
  const { selectedCompany, features } = useCompany();
  const feature = features.find((item) => item.key === 'forms');
  const [forms, setForms] = useState([]);
  const [statusFilter, setStatusFilter] = useState('active');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingForm, setEditingForm] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedFile, setSelectedFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploadStage, setUploadStage] = useState('');

  const endpoint = useMemo(() => {
    if (!selectedCompany) return '';
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (categoryFilter) params.set('category', categoryFilter);
    if (search) params.set('search', search);
    params.set('limit', '100');
    const query = params.toString();
    return `/api/admin/business-units/${selectedCompany.id}/forms${query ? `?${query}` : ''}`;
  }, [selectedCompany, statusFilter, categoryFilter, search]);

  const loadForms = useCallback(async () => {
    if (!endpoint) return;
    setLoading(true);
    try {
      const payload = await apiRequest(endpoint);
      setForms(Array.isArray(payload?.data) ? payload.data : []);
      setError('');
    } catch (loadError) {
      setForms([]);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load forms.');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    loadForms();
  }, [loadForms]);

  useEffect(() => {
    setEditorOpen(false);
    setEditingForm(null);
    setForm(emptyForm);
    setSelectedFile(null);
    setError('');
  }, [selectedCompany?.id]);

  const categories = useMemo(() => {
    return Array.from(new Set([
      ...defaultCategories,
      ...forms.map((item) => item.category).filter(Boolean),
    ])).sort();
  }, [forms]);

  if (!selectedCompany || !feature?.enabled) {
    return <Navigate to="/dashboard" replace />;
  }

  function openCreate() {
    setEditingForm(null);
    setForm(emptyForm);
    setSelectedFile(null);
    setUploadStage('');
    setEditorOpen(true);
  }

  function openEdit(record) {
    setEditingForm(record);
    setForm(formFromRecord(record));
    setSelectedFile(null);
    setUploadStage('');
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingForm(null);
    setForm(emptyForm);
    setSelectedFile(null);
    setUploadStage('');
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function createWithUpload() {
    const contentType = selectedFile.type || 'application/octet-stream';
    setUploadStage('Preparing upload…');
    const intentPayload = await apiRequest(
      `/api/admin/business-units/${selectedCompany.id}/forms/upload-intent`,
      {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          description: nullable(form.description),
          category: form.category.trim() || 'general',
          version: form.version.trim() || '1',
          schema: {},
          fileName: selectedFile.name,
          contentType,
          byteSize: selectedFile.size,
        }),
      },
    );

    const created = intentPayload?.data?.form;
    const upload = intentPayload?.data?.upload;
    if (!created?.id || !upload?.url) {
      throw new Error('The backend did not return a valid form upload target.');
    }

    try {
      setUploadStage(`Uploading ${selectedFile.name}…`);
      const uploadResponse = await fetch(upload.url, {
        method: upload.method || 'PUT',
        headers: { 'Content-Type': upload.contentType || contentType },
        body: selectedFile,
      });
      if (!uploadResponse.ok) {
        throw new Error(`File upload failed with status ${uploadResponse.status}.`);
      }

      setUploadStage('Finalizing form…');
      await apiRequest(
        `/api/admin/business-units/${selectedCompany.id}/forms/${created.id}/complete`,
        { method: 'POST' },
      );
    } catch (uploadError) {
      try {
        await apiRequest(
          `/api/admin/business-units/${selectedCompany.id}/forms/${created.id}`,
          { method: 'PATCH', body: JSON.stringify({ status: 'archived' }) },
        );
      } catch {
        // Preserve the original upload failure for the user.
      }
      throw uploadError;
    }
  }

  async function submitForm(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (editingForm) {
        await apiRequest(
          `/api/admin/business-units/${selectedCompany.id}/forms/${editingForm.id}`,
          {
            method: 'PATCH',
            body: JSON.stringify({
              name: form.name.trim(),
              description: nullable(form.description),
              category: form.category.trim() || 'general',
              status: form.status,
            }),
          },
        );
      } else if (selectedFile) {
        await createWithUpload();
      } else {
        await apiRequest(`/api/admin/business-units/${selectedCompany.id}/forms`, {
          method: 'POST',
          body: JSON.stringify({
            name: form.name.trim(),
            description: nullable(form.description),
            category: form.category.trim() || 'general',
            version: form.version.trim() || '1',
            schema: {},
          }),
        });
      }

      closeEditor();
      await loadForms();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save form.');
    } finally {
      setSaving(false);
      setUploadStage('');
    }
  }

  async function updateStatus(record, status) {
    setBusyId(record.id);
    try {
      const payload = await apiRequest(
        `/api/admin/business-units/${selectedCompany.id}/forms/${record.id}`,
        { method: 'PATCH', body: JSON.stringify({ status }) },
      );
      setForms((current) => current.map((item) => (
        item.id === record.id ? payload.data : item
      )));
      setError('');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update form.');
    } finally {
      setBusyId('');
    }
  }

  async function downloadForm(record) {
    if (!record.fileId) return;
    setBusyId(record.id);
    try {
      const payload = await apiRequest(
        `/api/admin/business-units/${selectedCompany.id}/forms/${record.id}/download`,
      );
      const url = payload?.data?.download?.url;
      if (!url) throw new Error('The backend did not return a download URL.');
      startDownload(url, payload?.data?.file?.fileName || record.name);
      setError('');
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download form.');
    } finally {
      setBusyId('');
    }
  }

  function submitSearch(event) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  return (
    <section className="page-panel">
      <p className="eyebrow">{selectedCompany.name}</p>
      <div className="page-heading-row">
        <div>
          <h1>Forms Library</h1>
          <p className="page-description">Store and manage reusable company forms, logs, reports, and templates.</p>
        </div>
        <button className="primary-button page-action-button" type="button" onClick={openCreate}>
          Add form
        </button>
      </div>

      <div className="feature-toolbar">
        <form className="search-form" onSubmit={submitSearch}>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search form name or description…"
            aria-label="Search forms"
          />
          <button className="secondary-button" type="submit">Search</button>
          {(search || searchInput) && (
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setSearchInput('');
                setSearch('');
              }}
            >
              Clear
            </button>
          )}
        </form>

        <label className="filter-field">
          <span>Category</span>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{formatCategory(category)}</option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>

      {error && <p className="form-error section-error">{error}</p>}

      {editorOpen && (
        <form className="customer-editor forms-editor" onSubmit={submitForm}>
          <div className="editor-heading">
            <div>
              <span className="editor-kicker">{editingForm ? 'Edit form' : 'New form'}</span>
              <h2>{editingForm?.name || 'Form details'}</h2>
            </div>
            <button className="text-button" type="button" disabled={saving} onClick={closeEditor}>Close</button>
          </div>

          <div className="form-grid">
            <label className="form-field full-width">
              <span>Form name</span>
              <input value={form.name} onChange={(event) => updateForm('name', event.target.value)} required />
            </label>
            <label className="form-field">
              <span>Category</span>
              <input
                list="form-category-options"
                value={form.category}
                onChange={(event) => updateForm('category', event.target.value)}
                placeholder="general"
                required
              />
              <datalist id="form-category-options">
                {categories.map((category) => <option value={category} key={category} />)}
              </datalist>
            </label>
            <label className="form-field">
              <span>Version</span>
              <input
                value={form.version}
                onChange={(event) => updateForm('version', event.target.value)}
                disabled={Boolean(editingForm)}
                required
              />
            </label>
            {editingForm && (
              <label className="form-field">
                <span>Status</span>
                <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            )}
            <label className="form-field full-width">
              <span>Description</span>
              <textarea
                rows="3"
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
                placeholder="What this form is used for…"
              />
            </label>
            {!editingForm && (
              <label className="form-field full-width form-upload-field">
                <span>Form file</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.rtf,.odt,.ods,image/*"
                  onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
                />
                <small>
                  {selectedFile
                    ? `${selectedFile.name} · ${formatFileSize(selectedFile.size)}`
                    : 'Optional. Upload a PDF, document, spreadsheet, image, or other reusable form file up to 25 MB.'}
                </small>
              </label>
            )}
          </div>

          {uploadStage && <p className="upload-stage">{uploadStage}</p>}

          <div className="editor-actions">
            <button className="secondary-button" type="button" disabled={saving} onClick={closeEditor}>Cancel</button>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? (uploadStage || 'Saving…') : editingForm ? 'Save changes' : selectedFile ? 'Upload form' : 'Create form'}
            </button>
          </div>
        </form>
      )}

      <div className="data-section">
        <div className="table-wrap">
          <table className="feature-table forms-table">
            <thead>
              <tr>
                <th>Form</th>
                <th>Category</th>
                <th>Version</th>
                <th>Updated</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {forms.map((record) => (
                <tr key={record.id}>
                  <td>
                    <strong className="table-primary">{record.name}</strong>
                    <span className="table-secondary">{record.description || (record.fileId ? 'Stored form file' : 'No file attached')}</span>
                  </td>
                  <td><span className="category-chip">{formatCategory(record.category)}</span></td>
                  <td className="mono-cell">{record.version}</td>
                  <td>{formatDate(record.updatedAt)}</td>
                  <td>
                    <select
                      className="compact-select"
                      value={record.status}
                      disabled={busyId === record.id}
                      onChange={(event) => updateStatus(record, event.target.value)}
                    >
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </select>
                  </td>
                  <td>
                    <div className="row-button-group">
                      <button className="secondary-button compact-button" type="button" onClick={() => openEdit(record)}>
                        Edit
                      </button>
                      {record.fileId && record.status === 'active' && (
                        <button
                          className="secondary-button compact-button"
                          type="button"
                          disabled={busyId === record.id}
                          onClick={() => downloadForm(record)}
                        >
                          {busyId === record.id ? 'Opening…' : 'Download'}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && forms.length === 0 && (
                <tr><td colSpan="6" className="empty-cell">No forms match this view.</td></tr>
              )}
              {loading && (
                <tr><td colSpan="6" className="empty-cell">Loading forms…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
