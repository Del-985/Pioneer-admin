import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext.jsx';
import { apiRequest } from '../lib/api.js';

function nullable(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
}

function emptyProfile(name = '') {
  return {
    brandName: name,
    tagline: '',
    description: '',
    logoUrl: '',
    faviconUrl: '',
    contactEmail: '',
    contactPhone: '',
    socialLinks: {},
    metadata: {},
  };
}

function normalizeProfile(profile, fallbackName) {
  return {
    ...emptyProfile(fallbackName),
    ...(profile || {}),
    brandName: profile?.brandName || fallbackName || '',
    tagline: profile?.tagline || '',
    description: profile?.description || '',
    logoUrl: profile?.logoUrl || '',
    faviconUrl: profile?.faviconUrl || '',
    contactEmail: profile?.contactEmail || '',
    contactPhone: profile?.contactPhone || '',
    socialLinks: profile?.socialLinks || {},
    metadata: profile?.metadata || {},
  };
}

function normalizeDirectoryProfile(record, company) {
  return {
    publicName: record?.publicName || company?.name || '',
    shortDescription: record?.shortDescription || '',
    websiteUrl: record?.websiteUrl || '',
    sortOrder: Number(record?.sortOrder ?? 0),
    isPublished: Boolean(record?.isPublished),
  };
}

export function WebsitePage() {
  const { selectedCompany, features } = useCompany();
  const feature = features.find((item) => item.key === 'website');
  const [site, setSite] = useState(null);
  const [profile, setProfile] = useState(emptyProfile());
  const [directoryProfile, setDirectoryProfile] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingDirectory, setSavingDirectory] = useState(false);
  const [busyPage, setBusyPage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const siteKey = site?.key || '';

  const loadWebsite = useCallback(async () => {
    if (!selectedCompany?.id) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const sitePayload = await apiRequest(`/api/admin/business-units/${selectedCompany.id}/site`);
      const resolvedSite = sitePayload?.data || null;
      setSite(resolvedSite);

      if (!resolvedSite?.key) {
        setProfile(emptyProfile(selectedCompany.name));
        setDirectoryProfile(null);
        setPages([]);
        return;
      }

      const [adminPayload, directoryPayload] = await Promise.all([
        apiRequest(`/api/admin/sites/${resolvedSite.key}`),
        apiRequest(`/api/admin/sites/${resolvedSite.key}/business-units`),
      ]);

      const adminData = adminPayload?.data || {};
      const directoryRows = Array.isArray(directoryPayload?.data) ? directoryPayload.data : [];
      const directoryRecord = directoryRows.find((row) => row.slug === selectedCompany.slug) || directoryRows[0] || null;

      setProfile(normalizeProfile(adminData.profile, selectedCompany.name));
      setPages(Array.isArray(adminData.pages) ? adminData.pages : []);
      setDirectoryProfile(normalizeDirectoryProfile(directoryRecord, selectedCompany));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load website configuration.');
      setSite(null);
      setPages([]);
      setDirectoryProfile(null);
    } finally {
      setLoading(false);
    }
  }, [selectedCompany?.id, selectedCompany?.name, selectedCompany?.slug]);

  useEffect(() => {
    void loadWebsite();
  }, [loadWebsite]);

  const publishedPages = useMemo(
    () => pages.filter((page) => page.status === 'published').length,
    [pages],
  );

  if (!selectedCompany || !feature?.enabled) {
    return <Navigate to="/dashboard" replace />;
  }

  function updateProfile(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function updateDirectory(field, value) {
    setDirectoryProfile((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile(event) {
    event.preventDefault();
    if (!siteKey) return;
    setSavingProfile(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/api/admin/sites/${siteKey}/profile`, {
        method: 'PUT',
        body: JSON.stringify({
          brandName: profile.brandName.trim(),
          tagline: nullable(profile.tagline),
          description: nullable(profile.description),
          logoUrl: nullable(profile.logoUrl),
          faviconUrl: nullable(profile.faviconUrl),
          contactEmail: nullable(profile.contactEmail),
          contactPhone: nullable(profile.contactPhone),
          socialLinks: profile.socialLinks || {},
          metadata: profile.metadata || {},
        }),
      });
      setSuccess('Website profile saved.');
      await loadWebsite();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save website profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveDirectoryProfile(event) {
    event.preventDefault();
    if (!siteKey || !directoryProfile) return;
    setSavingDirectory(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/api/admin/sites/${siteKey}/business-units/${selectedCompany.slug}`, {
        method: 'PUT',
        body: JSON.stringify({
          publicName: directoryProfile.publicName.trim(),
          shortDescription: nullable(directoryProfile.shortDescription),
          websiteUrl: nullable(directoryProfile.websiteUrl),
          sortOrder: Number(directoryProfile.sortOrder) || 0,
          isPublished: Boolean(directoryProfile.isPublished),
        }),
      });
      setSuccess('Public company listing saved.');
      await loadWebsite();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save public company listing.');
    } finally {
      setSavingDirectory(false);
    }
  }

  async function changePageStatus(page, status) {
    if (!siteKey || busyPage) return;
    setBusyPage(page.slug);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/api/admin/sites/${siteKey}/pages/${page.slug}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: page.title,
          navigationLabel: page.navigationLabel ?? null,
          showInNavigation: Boolean(page.showInNavigation),
          navigationOrder: Number(page.navigationOrder) || 0,
          content: page.content || {},
          seoTitle: page.seoTitle ?? null,
          seoDescription: page.seoDescription ?? null,
          status,
          publishedAt: status === 'published' ? (page.publishedAt || new Date().toISOString()) : null,
        }),
      });
      setSuccess(`${page.title} is now ${status}.`);
      await loadWebsite();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update page status.');
    } finally {
      setBusyPage('');
    }
  }

  return (
    <section className="page-panel website-page">
      <div className="page-heading-row">
        <div>
          <p className="eyebrow">{selectedCompany.name}</p>
          <h1>Website</h1>
          <p className="page-description">Manage the public website profile, company directory listing, and publishing status.</p>
        </div>
        {site?.publicUrl && (
          <a className="secondary-button page-action-button" href={site.publicUrl} target="_blank" rel="noreferrer">
            Open live site
          </a>
        )}
      </div>

      {error && <p className="form-error section-error">{error}</p>}
      {success && <p className="form-success section-success">{success}</p>}

      {loading ? (
        <p className="loading-copy">Loading website configuration…</p>
      ) : !site ? (
        <div className="feature-placeholder">
          <strong>No website is attached to this company yet.</strong>
          <p>Once a site record is assigned to this business unit, this panel will manage it automatically.</p>
        </div>
      ) : (
        <>
          <div className="lead-summary" aria-label="Website status">
            <span><strong>Status:</strong> {site.status}</span>
            <span><strong>Hostname:</strong> {site.primaryHostname || 'Not configured'}</span>
            <span><strong>Site key:</strong> {site.key}</span>
            <span><strong>Pages:</strong> {publishedPages} published / {pages.length} total</span>
          </div>

          <form className="customer-editor" onSubmit={saveProfile}>
            <div className="editor-heading">
              <div>
                <span className="editor-kicker">Live site profile</span>
                <h2>Branding and contact information</h2>
                <p className="section-subtitle">These fields are served by the shared backend to the public website.</p>
              </div>
            </div>

            <div className="form-grid">
              <label className="form-field">
                <span>Brand name</span>
                <input value={profile.brandName} onChange={(event) => updateProfile('brandName', event.target.value)} required maxLength={160} />
              </label>
              <label className="form-field">
                <span>Tagline</span>
                <input value={profile.tagline} onChange={(event) => updateProfile('tagline', event.target.value)} maxLength={240} />
              </label>
              <label className="form-field full-width">
                <span>Description</span>
                <textarea rows="5" value={profile.description} onChange={(event) => updateProfile('description', event.target.value)} maxLength={5000} />
              </label>
              <label className="form-field">
                <span>Contact email</span>
                <input type="email" value={profile.contactEmail} onChange={(event) => updateProfile('contactEmail', event.target.value)} maxLength={254} />
              </label>
              <label className="form-field">
                <span>Contact phone</span>
                <input value={profile.contactPhone} onChange={(event) => updateProfile('contactPhone', event.target.value)} maxLength={40} />
              </label>
              <label className="form-field">
                <span>Logo URL</span>
                <input type="url" value={profile.logoUrl} onChange={(event) => updateProfile('logoUrl', event.target.value)} maxLength={2000} />
              </label>
              <label className="form-field">
                <span>Favicon URL</span>
                <input type="url" value={profile.faviconUrl} onChange={(event) => updateProfile('faviconUrl', event.target.value)} maxLength={2000} />
              </label>
            </div>

            <div className="editor-actions">
              <button className="primary-button" type="submit" disabled={savingProfile}>
                {savingProfile ? 'Saving…' : 'Save website profile'}
              </button>
            </div>
          </form>

          {directoryProfile && (
            <form className="customer-editor" onSubmit={saveDirectoryProfile}>
              <div className="editor-heading">
                <div>
                  <span className="editor-kicker">Pioneer company directory</span>
                  <h2>Public company listing</h2>
                  <p className="section-subtitle">Controls how this company appears on the Pioneer Legacy Works Companies section.</p>
                </div>
              </div>

              <div className="form-grid">
                <label className="form-field">
                  <span>Public name</span>
                  <input value={directoryProfile.publicName} onChange={(event) => updateDirectory('publicName', event.target.value)} required maxLength={160} />
                </label>
                <label className="form-field">
                  <span>Website URL</span>
                  <input type="url" value={directoryProfile.websiteUrl} onChange={(event) => updateDirectory('websiteUrl', event.target.value)} maxLength={2000} />
                </label>
                <label className="form-field full-width">
                  <span>Short description</span>
                  <textarea rows="4" value={directoryProfile.shortDescription} onChange={(event) => updateDirectory('shortDescription', event.target.value)} maxLength={1000} />
                </label>
                <label className="form-field">
                  <span>Sort order</span>
                  <input type="number" min="-10000" max="10000" value={directoryProfile.sortOrder} onChange={(event) => updateDirectory('sortOrder', event.target.value)} />
                </label>
                <label className="form-field">
                  <span>Directory status</span>
                  <select value={directoryProfile.isPublished ? 'published' : 'hidden'} onChange={(event) => updateDirectory('isPublished', event.target.value === 'published')}>
                    <option value="published">Published</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </label>
              </div>

              <div className="editor-actions">
                <button className="primary-button" type="submit" disabled={savingDirectory}>
                  {savingDirectory ? 'Saving…' : 'Save company listing'}
                </button>
              </div>
            </form>
          )}

          <section className="customer-editor">
            <div className="editor-heading">
              <div>
                <span className="editor-kicker">Publishing</span>
                <h2>Pages</h2>
                <p className="section-subtitle">Quickly publish or return existing backend-managed pages to draft.</p>
              </div>
              <span className="record-count">{pages.length} page{pages.length === 1 ? '' : 's'}</span>
            </div>

            {pages.length === 0 ? (
              <p className="empty-copy">No backend-managed pages have been created for this site yet.</p>
            ) : (
              <div className="feature-config-grid">
                {pages.map((page) => (
                  <article className="feature-config-card" key={page.slug}>
                    <div>
                      <span className="feature-category">{page.status}</span>
                      <h3>{page.title}</h3>
                      <p>/{page.slug}{page.showInNavigation ? ' · shown in navigation' : ''}</p>
                    </div>
                    <div className="row-button-group">
                      {page.status !== 'published' && (
                        <button className="secondary-button compact-button" type="button" disabled={busyPage === page.slug} onClick={() => changePageStatus(page, 'published')}>
                          Publish
                        </button>
                      )}
                      {page.status === 'published' && (
                        <button className="secondary-button compact-button" type="button" disabled={busyPage === page.slug} onClick={() => changePageStatus(page, 'draft')}>
                          Move to draft
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}
