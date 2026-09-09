import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext.jsx';
import { apiRequest } from '../lib/api.js';

const TAB_ITEMS = [
  { key: 'overview', label: 'Overview' },
  { key: 'homepage', label: 'Homepage' },
  { key: 'services', label: 'Services' },
  { key: 'pages', label: 'Pages & Navigation' },
  { key: 'settings', label: 'Settings' },
];

function nullable(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed ? trimmed : null;
}

function slugify(value) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
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

function emptyCms() {
  return {
    homepage: {
      eyebrow: '',
      heroHeadline: '',
      heroSubheadline: '',
      primaryCtaLabel: 'Request Service',
      primaryCtaHref: '#request-service',
      secondaryCtaLabel: 'View Services',
      secondaryCtaHref: 'services.html',
      introText: '',
      serviceAreaText: '',
      trustStatement: '',
    },
    services: [],
    serviceArea: {
      primaryAreas: '',
      extendedAreas: '',
      notice: '',
    },
    requests: {
      accepting: true,
      confirmationMessage: '',
    },
    announcement: {
      enabled: false,
      text: '',
      tone: 'info',
    },
    seo: {
      defaultTitle: '',
      defaultDescription: '',
    },
  };
}

function normalizeCms(metadata = {}) {
  const defaults = emptyCms();
  const stored = metadata?.cms || {};
  return {
    ...defaults,
    ...stored,
    homepage: { ...defaults.homepage, ...(stored.homepage || {}) },
    services: Array.isArray(stored.services) ? stored.services : [],
    serviceArea: { ...defaults.serviceArea, ...(stored.serviceArea || {}) },
    requests: { ...defaults.requests, ...(stored.requests || {}) },
    announcement: { ...defaults.announcement, ...(stored.announcement || {}) },
    seo: { ...defaults.seo, ...(stored.seo || {}) },
  };
}

function normalizePage(page) {
  return {
    ...page,
    title: page?.title || '',
    navigationLabel: page?.navigationLabel || '',
    showInNavigation: Boolean(page?.showInNavigation),
    navigationOrder: Number(page?.navigationOrder ?? 0),
    content: page?.content || {},
    seoTitle: page?.seoTitle || '',
    seoDescription: page?.seoDescription || '',
    status: page?.status || 'draft',
    publishedAt: page?.publishedAt || null,
  };
}

function createService() {
  return {
    id: globalThis.crypto?.randomUUID?.() || `service-${Date.now()}`,
    name: '',
    description: '',
    priceLabel: '',
    tag: '',
    featured: false,
    requestable: true,
    active: true,
    sortOrder: 0,
  };
}

function WebsiteOverview({ site, pages, cms, onTabChange }) {
  const publishedPages = pages.filter((page) => page.status === 'published').length;
  const activeServices = cms.services.filter((service) => service.active !== false).length;

  return (
    <div className="website-cms-section">
      <div className="website-status-grid">
        <article className="website-status-card">
          <span>Website</span>
          <strong>{site.status || 'unknown'}</strong>
          <small>{site.primaryHostname || 'No hostname configured'}</small>
        </article>
        <article className="website-status-card">
          <span>Published pages</span>
          <strong>{publishedPages}</strong>
          <small>{pages.length} total backend-managed pages</small>
        </article>
        <article className="website-status-card">
          <span>Active services</span>
          <strong>{activeServices}</strong>
          <small>{cms.services.length} configured services</small>
        </article>
        <article className="website-status-card">
          <span>Online requests</span>
          <strong>{cms.requests.accepting ? 'Open' : 'Paused'}</strong>
          <small>{cms.requests.accepting ? 'Customers can submit requests' : 'Request form is disabled'}</small>
        </article>
      </div>

      <div className="website-action-grid">
        <button type="button" onClick={() => onTabChange('homepage')}>
          <strong>Edit homepage</strong>
          <span>Hero content, calls to action, service-area copy, and trust messaging.</span>
        </button>
        <button type="button" onClick={() => onTabChange('services')}>
          <strong>Manage services</strong>
          <span>Control customer-facing services, pricing labels, and request availability.</span>
        </button>
        <button type="button" onClick={() => onTabChange('pages')}>
          <strong>Pages & navigation</strong>
          <span>Create pages, edit navigation, SEO, and publishing state.</span>
        </button>
        <button type="button" onClick={() => onTabChange('settings')}>
          <strong>Website settings</strong>
          <span>Branding, contact information, announcements, service area, and SEO defaults.</span>
        </button>
      </div>
    </div>
  );
}

export function WebsitePage() {
  const { selectedCompany, features } = useCompany();
  const feature = features.find((item) => item.key === 'website');
  const [activeTab, setActiveTab] = useState('overview');
  const [site, setSite] = useState(null);
  const [profile, setProfile] = useState(emptyProfile());
  const [cms, setCms] = useState(emptyCms());
  const [directoryProfile, setDirectoryProfile] = useState(null);
  const [pages, setPages] = useState([]);
  const [pageDraft, setPageDraft] = useState(null);
  const [newPage, setNewPage] = useState({ title: '', slug: '', navigationLabel: '', showInNavigation: true });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyPage, setBusyPage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const siteKey = site?.key || '';

  const loadWebsite = useCallback(async () => {
    if (!selectedCompany?.id) return;
    setLoading(true);
    setError('');

    try {
      const sitePayload = await apiRequest(`/api/admin/business-units/${selectedCompany.id}/site`);
      const resolvedSite = sitePayload?.data || null;
      setSite(resolvedSite);

      if (!resolvedSite?.key) {
        setProfile(emptyProfile(selectedCompany.name));
        setCms(emptyCms());
        setDirectoryProfile(null);
        setPages([]);
        setPageDraft(null);
        return;
      }

      const [adminPayload, directoryPayload] = await Promise.all([
        apiRequest(`/api/admin/sites/${resolvedSite.key}`),
        apiRequest(`/api/admin/sites/${resolvedSite.key}/business-units`),
      ]);

      const adminData = adminPayload?.data || {};
      const normalizedProfile = normalizeProfile(adminData.profile, selectedCompany.name);
      const nextPages = Array.isArray(adminData.pages) ? adminData.pages.map(normalizePage) : [];
      const directoryRows = Array.isArray(directoryPayload?.data) ? directoryPayload.data : [];
      const directoryRecord = directoryRows.find((row) => row.slug === selectedCompany.slug) || directoryRows[0] || null;

      setProfile(normalizedProfile);
      setCms(normalizeCms(normalizedProfile.metadata));
      setPages(nextPages);
      setDirectoryProfile(normalizeDirectoryProfile(directoryRecord, selectedCompany));
      setPageDraft((current) => {
        if (!current?.slug) return null;
        const refreshed = nextPages.find((page) => page.slug === current.slug);
        return refreshed ? normalizePage(refreshed) : null;
      });
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

  if (!selectedCompany || !feature?.enabled) {
    return <Navigate to="/dashboard" replace />;
  }

  function updateHomepage(field, value) {
    setCms((current) => ({
      ...current,
      homepage: { ...current.homepage, [field]: value },
    }));
  }

  function updateServiceArea(field, value) {
    setCms((current) => ({
      ...current,
      serviceArea: { ...current.serviceArea, [field]: value },
    }));
  }

  function updateRequests(field, value) {
    setCms((current) => ({
      ...current,
      requests: { ...current.requests, [field]: value },
    }));
  }

  function updateAnnouncement(field, value) {
    setCms((current) => ({
      ...current,
      announcement: { ...current.announcement, [field]: value },
    }));
  }

  function updateSeo(field, value) {
    setCms((current) => ({
      ...current,
      seo: { ...current.seo, [field]: value },
    }));
  }

  function updateService(id, field, value) {
    setCms((current) => ({
      ...current,
      services: current.services.map((service) =>
        service.id === id ? { ...service, [field]: value } : service,
      ),
    }));
  }

  function updateDirectory(field, value) {
    setDirectoryProfile((current) => ({ ...current, [field]: value }));
  }

  async function persistProfile(message) {
    if (!siteKey) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const metadata = { ...(profile.metadata || {}), cms };
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
          metadata,
        }),
      });
      setSuccess(message);
      await loadWebsite();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save website changes.');
    } finally {
      setSaving(false);
    }
  }

  async function saveDirectoryProfile(event) {
    event.preventDefault();
    if (!siteKey || !directoryProfile) return;
    setSaving(true);
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
      setSaving(false);
    }
  }

  async function createPage(event) {
    event.preventDefault();
    if (!siteKey) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest(`/api/admin/sites/${siteKey}/pages`, {
        method: 'POST',
        body: JSON.stringify({
          slug: slugify(newPage.slug || newPage.title),
          title: newPage.title.trim(),
          navigationLabel: nullable(newPage.navigationLabel),
          showInNavigation: Boolean(newPage.showInNavigation),
          navigationOrder: pages.length * 10,
          content: { body: '' },
          seoTitle: null,
          seoDescription: null,
          status: 'draft',
          publishedAt: null,
        }),
      });
      setNewPage({ title: '', slug: '', navigationLabel: '', showInNavigation: true });
      setSuccess('Page created as a draft.');
      await loadWebsite();
      if (payload?.data) setPageDraft(normalizePage(payload.data));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to create the page.');
    } finally {
      setSaving(false);
    }
  }

  async function savePage(event) {
    event.preventDefault();
    if (!siteKey || !pageDraft?.slug) return;
    setBusyPage(pageDraft.slug);
    setError('');
    setSuccess('');
    try {
      const status = pageDraft.status || 'draft';
      await apiRequest(`/api/admin/sites/${siteKey}/pages/${pageDraft.slug}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: pageDraft.title.trim(),
          navigationLabel: nullable(pageDraft.navigationLabel),
          showInNavigation: Boolean(pageDraft.showInNavigation),
          navigationOrder: Number(pageDraft.navigationOrder) || 0,
          content: pageDraft.content || {},
          seoTitle: nullable(pageDraft.seoTitle),
          seoDescription: nullable(pageDraft.seoDescription),
          status,
          publishedAt: status === 'published' ? (pageDraft.publishedAt || new Date().toISOString()) : null,
        }),
      });
      setSuccess(`${pageDraft.title} saved.`);
      await loadWebsite();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save the page.');
    } finally {
      setBusyPage('');
    }
  }

  const orderedServices = useMemo(
    () => [...cms.services].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
    [cms.services],
  );

  return (
    <section className="page-panel website-page website-cms">
      <div className="page-heading-row website-cms-heading">
        <div>
          <p className="eyebrow">{selectedCompany.name}</p>
          <h1>Website</h1>
          <p className="page-description">Changes saved here are stored in the shared Pioneer backend and published to the attached business website.</p>
        </div>
        <div className="website-heading-actions">
          <button className="secondary-button" type="button" onClick={() => void loadWebsite()} disabled={loading}>Refresh</button>
          {site?.publicUrl && (
            <a className="secondary-button page-action-button" href={site.publicUrl} target="_blank" rel="noreferrer">Open live site</a>
          )}
        </div>
      </div>

      {error && <p className="form-error section-error">{error}</p>}
      {success && <p className="form-success section-success">{success}</p>}

      {loading ? (
        <p className="loading-copy">Loading website configuration…</p>
      ) : !site ? (
        <div className="feature-placeholder">
          <strong>No website is attached to this company yet.</strong>
          <p>Attach a site record to this business unit before using the Website workspace.</p>
        </div>
      ) : (
        <>
          <nav className="website-cms-tabs" aria-label="Website editor sections">
            {TAB_ITEMS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={activeTab === tab.key ? 'active' : ''}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === 'overview' && (
            <WebsiteOverview site={site} pages={pages} cms={cms} onTabChange={setActiveTab} />
          )}

          {activeTab === 'homepage' && (
            <form className="website-cms-section website-editor-form" onSubmit={(event) => { event.preventDefault(); void persistProfile('Homepage settings saved.'); }}>
              <div className="website-section-heading">
                <div><span>Homepage</span><h2>Hero and primary messaging</h2></div>
                <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save homepage'}</button>
              </div>
              <div className="form-grid">
                <label className="form-field"><span>Eyebrow</span><input value={cms.homepage.eyebrow} onChange={(event) => updateHomepage('eyebrow', event.target.value)} maxLength={160} placeholder="Snow & ice service • Toledo, Ohio" /></label>
                <label className="form-field full-width"><span>Hero headline</span><input value={cms.homepage.heroHeadline} onChange={(event) => updateHomepage('heroHeadline', event.target.value)} maxLength={240} placeholder="Reliable outdoor service when the weather turns." /></label>
                <label className="form-field full-width"><span>Hero subheadline</span><textarea rows="4" value={cms.homepage.heroSubheadline} onChange={(event) => updateHomepage('heroSubheadline', event.target.value)} maxLength={1000} /></label>
                <label className="form-field"><span>Primary button label</span><input value={cms.homepage.primaryCtaLabel} onChange={(event) => updateHomepage('primaryCtaLabel', event.target.value)} maxLength={80} /></label>
                <label className="form-field"><span>Primary button destination</span><input value={cms.homepage.primaryCtaHref} onChange={(event) => updateHomepage('primaryCtaHref', event.target.value)} maxLength={500} /></label>
                <label className="form-field"><span>Secondary button label</span><input value={cms.homepage.secondaryCtaLabel} onChange={(event) => updateHomepage('secondaryCtaLabel', event.target.value)} maxLength={80} /></label>
                <label className="form-field"><span>Secondary button destination</span><input value={cms.homepage.secondaryCtaHref} onChange={(event) => updateHomepage('secondaryCtaHref', event.target.value)} maxLength={500} /></label>
                <label className="form-field full-width"><span>Homepage introduction</span><textarea rows="4" value={cms.homepage.introText} onChange={(event) => updateHomepage('introText', event.target.value)} maxLength={1500} /></label>
                <label className="form-field full-width"><span>Service-area homepage copy</span><textarea rows="3" value={cms.homepage.serviceAreaText} onChange={(event) => updateHomepage('serviceAreaText', event.target.value)} maxLength={1000} /></label>
                <label className="form-field full-width"><span>Trust statement</span><textarea rows="3" value={cms.homepage.trustStatement} onChange={(event) => updateHomepage('trustStatement', event.target.value)} maxLength={1000} /></label>
              </div>
            </form>
          )}

          {activeTab === 'services' && (
            <section className="website-cms-section">
              <div className="website-section-heading">
                <div><span>Services</span><h2>Customer-facing service catalog</h2><p>Active services are rendered on websites that support the shared CMS service catalog.</p></div>
                <div className="website-heading-actions">
                  <button className="secondary-button" type="button" onClick={() => setCms((current) => ({ ...current, services: [...current.services, createService()] }))}>Add service</button>
                  <button className="primary-button" type="button" disabled={saving} onClick={() => void persistProfile('Service catalog saved.')}>{saving ? 'Saving…' : 'Save services'}</button>
                </div>
              </div>

              {orderedServices.length === 0 ? (
                <div className="website-empty-state"><strong>No CMS services configured yet.</strong><p>Add a service to begin managing the live service catalog from Admin.</p></div>
              ) : (
                <div className="website-service-list">
                  {orderedServices.map((service, index) => (
                    <article className="website-service-editor" key={service.id}>
                      <div className="website-service-editor-heading"><strong>{service.name || `New service ${index + 1}`}</strong><button type="button" className="text-button" onClick={() => setCms((current) => ({ ...current, services: current.services.filter((item) => item.id !== service.id) }))}>Remove</button></div>
                      <div className="form-grid">
                        <label className="form-field"><span>Service name</span><input value={service.name} onChange={(event) => updateService(service.id, 'name', event.target.value)} maxLength={160} /></label>
                        <label className="form-field"><span>Display price</span><input value={service.priceLabel || ''} onChange={(event) => updateService(service.id, 'priceLabel', event.target.value)} maxLength={120} placeholder="Starting at $40" /></label>
                        <label className="form-field"><span>Label / tag</span><input value={service.tag || ''} onChange={(event) => updateService(service.id, 'tag', event.target.value)} maxLength={80} placeholder="Primary service" /></label>
                        <label className="form-field"><span>Sort order</span><input type="number" value={Number(service.sortOrder || 0)} onChange={(event) => updateService(service.id, 'sortOrder', Number(event.target.value) || 0)} /></label>
                        <label className="form-field full-width"><span>Description</span><textarea rows="3" value={service.description || ''} onChange={(event) => updateService(service.id, 'description', event.target.value)} maxLength={1200} /></label>
                      </div>
                      <div className="website-toggle-row">
                        <label><input type="checkbox" checked={service.active !== false} onChange={(event) => updateService(service.id, 'active', event.target.checked)} /> Active on website</label>
                        <label><input type="checkbox" checked={Boolean(service.featured)} onChange={(event) => updateService(service.id, 'featured', event.target.checked)} /> Featured</label>
                        <label><input type="checkbox" checked={service.requestable !== false} onChange={(event) => updateService(service.id, 'requestable', event.target.checked)} /> Can be requested online</label>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'pages' && (
            <section className="website-cms-section">
              <div className="website-section-heading"><div><span>Pages & navigation</span><h2>Publishing and navigation</h2></div></div>

              <form className="website-new-page" onSubmit={createPage}>
                <div><strong>Create page</strong><span>New pages begin as drafts.</span></div>
                <input aria-label="Page title" placeholder="Page title" value={newPage.title} onChange={(event) => setNewPage((current) => ({ ...current, title: event.target.value, slug: current.slug || slugify(event.target.value) }))} required />
                <input aria-label="Page slug" placeholder="page-slug" value={newPage.slug} onChange={(event) => setNewPage((current) => ({ ...current, slug: slugify(event.target.value) }))} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" />
                <input aria-label="Navigation label" placeholder="Navigation label (optional)" value={newPage.navigationLabel} onChange={(event) => setNewPage((current) => ({ ...current, navigationLabel: event.target.value }))} />
                <label><input type="checkbox" checked={newPage.showInNavigation} onChange={(event) => setNewPage((current) => ({ ...current, showInNavigation: event.target.checked }))} /> Show in navigation</label>
                <button className="secondary-button" type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create draft'}</button>
              </form>

              <div className="website-pages-layout">
                <div className="website-page-list">
                  {pages.map((page) => (
                    <button key={page.slug} type="button" className={pageDraft?.slug === page.slug ? 'active' : ''} onClick={() => setPageDraft(normalizePage(page))}>
                      <strong>{page.title}</strong><span>/{page.slug}</span><small>{page.status}{page.showInNavigation ? ' · navigation' : ''}</small>
                    </button>
                  ))}
                  {pages.length === 0 && <p className="empty-copy">No backend-managed pages yet.</p>}
                </div>

                {pageDraft ? (
                  <form className="website-page-editor" onSubmit={savePage}>
                    <div className="website-section-heading"><div><span>/{pageDraft.slug}</span><h3>Edit page</h3></div><button className="primary-button" type="submit" disabled={busyPage === pageDraft.slug}>{busyPage === pageDraft.slug ? 'Saving…' : 'Save page'}</button></div>
                    <div className="form-grid">
                      <label className="form-field"><span>Page title</span><input value={pageDraft.title} onChange={(event) => setPageDraft((current) => ({ ...current, title: event.target.value }))} required maxLength={200} /></label>
                      <label className="form-field"><span>Navigation label</span><input value={pageDraft.navigationLabel} onChange={(event) => setPageDraft((current) => ({ ...current, navigationLabel: event.target.value }))} maxLength={120} /></label>
                      <label className="form-field"><span>Navigation order</span><input type="number" min="-10000" max="10000" value={pageDraft.navigationOrder} onChange={(event) => setPageDraft((current) => ({ ...current, navigationOrder: Number(event.target.value) || 0 }))} /></label>
                      <label className="form-field"><span>Status</span><select value={pageDraft.status} onChange={(event) => setPageDraft((current) => ({ ...current, status: event.target.value, publishedAt: event.target.value === 'published' ? (current.publishedAt || new Date().toISOString()) : null }))}><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
                      <label className="form-field full-width"><span>Page body</span><textarea rows="8" value={pageDraft.content?.body || ''} onChange={(event) => setPageDraft((current) => ({ ...current, content: { ...(current.content || {}), body: event.target.value } }))} /></label>
                      <label className="form-field full-width"><span>SEO title</span><input value={pageDraft.seoTitle} onChange={(event) => setPageDraft((current) => ({ ...current, seoTitle: event.target.value }))} maxLength={200} /></label>
                      <label className="form-field full-width"><span>SEO description</span><textarea rows="3" value={pageDraft.seoDescription} onChange={(event) => setPageDraft((current) => ({ ...current, seoDescription: event.target.value }))} maxLength={500} /></label>
                    </div>
                    <label className="website-inline-checkbox"><input type="checkbox" checked={pageDraft.showInNavigation} onChange={(event) => setPageDraft((current) => ({ ...current, showInNavigation: event.target.checked }))} /> Show this published page in website navigation</label>
                  </form>
                ) : (
                  <div className="website-empty-state"><strong>Select a page to edit it.</strong><p>Page content, navigation, SEO, and publishing state are persisted through the shared backend.</p></div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'settings' && (
            <div className="website-cms-section website-settings-stack">
              <form className="website-editor-form" onSubmit={(event) => { event.preventDefault(); void persistProfile('Website settings saved.'); }}>
                <div className="website-section-heading"><div><span>Branding & contact</span><h2>Public business identity</h2></div><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save settings'}</button></div>
                <div className="form-grid">
                  <label className="form-field"><span>Brand name</span><input value={profile.brandName} onChange={(event) => setProfile((current) => ({ ...current, brandName: event.target.value }))} required maxLength={160} /></label>
                  <label className="form-field"><span>Tagline</span><input value={profile.tagline} onChange={(event) => setProfile((current) => ({ ...current, tagline: event.target.value }))} maxLength={240} /></label>
                  <label className="form-field full-width"><span>Business description</span><textarea rows="4" value={profile.description} onChange={(event) => setProfile((current) => ({ ...current, description: event.target.value }))} maxLength={5000} /></label>
                  <label className="form-field"><span>Contact email</span><input type="email" value={profile.contactEmail} onChange={(event) => setProfile((current) => ({ ...current, contactEmail: event.target.value }))} maxLength={254} /></label>
                  <label className="form-field"><span>Contact phone</span><input value={profile.contactPhone} onChange={(event) => setProfile((current) => ({ ...current, contactPhone: event.target.value }))} maxLength={40} /></label>
                  <label className="form-field"><span>Logo URL</span><input type="url" value={profile.logoUrl} onChange={(event) => setProfile((current) => ({ ...current, logoUrl: event.target.value }))} maxLength={2000} /></label>
                  <label className="form-field"><span>Favicon URL</span><input type="url" value={profile.faviconUrl} onChange={(event) => setProfile((current) => ({ ...current, faviconUrl: event.target.value }))} maxLength={2000} /></label>
                </div>

                <div className="website-settings-block">
                  <h3>Service area</h3>
                  <div className="form-grid">
                    <label className="form-field"><span>Primary areas</span><input value={cms.serviceArea.primaryAreas} onChange={(event) => updateServiceArea('primaryAreas', event.target.value)} placeholder="Toledo, OH" /></label>
                    <label className="form-field"><span>Extended / review areas</span><input value={cms.serviceArea.extendedAreas} onChange={(event) => updateServiceArea('extendedAreas', event.target.value)} placeholder="Nearby communities subject to route capacity" /></label>
                    <label className="form-field full-width"><span>Customer-facing service area notice</span><textarea rows="3" value={cms.serviceArea.notice} onChange={(event) => updateServiceArea('notice', event.target.value)} /></label>
                  </div>
                </div>

                <div className="website-settings-block">
                  <h3>Online requests</h3>
                  <label className="website-inline-checkbox"><input type="checkbox" checked={cms.requests.accepting} onChange={(event) => updateRequests('accepting', event.target.checked)} /> Accept website service requests</label>
                  <label className="form-field full-width"><span>Confirmation message</span><textarea rows="3" value={cms.requests.confirmationMessage} onChange={(event) => updateRequests('confirmationMessage', event.target.value)} placeholder="Optional custom message shown after a successful request." /></label>
                </div>

                <div className="website-settings-block">
                  <h3>Announcement banner</h3>
                  <div className="form-grid">
                    <label className="form-field"><span>Banner status</span><select value={cms.announcement.enabled ? 'enabled' : 'disabled'} onChange={(event) => updateAnnouncement('enabled', event.target.value === 'enabled')}><option value="disabled">Hidden</option><option value="enabled">Visible</option></select></label>
                    <label className="form-field"><span>Tone</span><select value={cms.announcement.tone} onChange={(event) => updateAnnouncement('tone', event.target.value)}><option value="info">Information</option><option value="success">Positive</option><option value="warning">Warning</option><option value="urgent">Urgent</option></select></label>
                    <label className="form-field full-width"><span>Banner message</span><textarea rows="3" value={cms.announcement.text} onChange={(event) => updateAnnouncement('text', event.target.value)} placeholder="Snow service bookings are open." /></label>
                  </div>
                </div>

                <div className="website-settings-block">
                  <h3>SEO defaults</h3>
                  <div className="form-grid">
                    <label className="form-field full-width"><span>Default page title</span><input value={cms.seo.defaultTitle} onChange={(event) => updateSeo('defaultTitle', event.target.value)} maxLength={200} /></label>
                    <label className="form-field full-width"><span>Default meta description</span><textarea rows="3" value={cms.seo.defaultDescription} onChange={(event) => updateSeo('defaultDescription', event.target.value)} maxLength={500} /></label>
                  </div>
                </div>
              </form>

              {directoryProfile && (
                <form className="website-editor-form" onSubmit={saveDirectoryProfile}>
                  <div className="website-section-heading"><div><span>Pioneer Legacy Works</span><h2>Company directory listing</h2></div><button className="secondary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save directory listing'}</button></div>
                  <div className="form-grid">
                    <label className="form-field"><span>Public name</span><input value={directoryProfile.publicName} onChange={(event) => updateDirectory('publicName', event.target.value)} required maxLength={160} /></label>
                    <label className="form-field"><span>Website URL</span><input type="url" value={directoryProfile.websiteUrl} onChange={(event) => updateDirectory('websiteUrl', event.target.value)} maxLength={2000} /></label>
                    <label className="form-field full-width"><span>Short description</span><textarea rows="3" value={directoryProfile.shortDescription} onChange={(event) => updateDirectory('shortDescription', event.target.value)} maxLength={1000} /></label>
                    <label className="form-field"><span>Sort order</span><input type="number" min="-10000" max="10000" value={directoryProfile.sortOrder} onChange={(event) => updateDirectory('sortOrder', Number(event.target.value) || 0)} /></label>
                    <label className="form-field"><span>Directory status</span><select value={directoryProfile.isPublished ? 'published' : 'hidden'} onChange={(event) => updateDirectory('isPublished', event.target.value === 'published')}><option value="published">Published</option><option value="hidden">Hidden</option></select></label>
                  </div>
                </form>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
