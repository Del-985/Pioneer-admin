import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext.jsx';
import { apiRequest } from '../lib/api.js';

const SEASONS = [
  {
    value: 'winter',
    label: 'Winter',
    description: 'Snow removal, sidewalk clearing, salting, and winter-service messaging.',
  },
  {
    value: 'warm',
    label: 'Spring–Fall',
    description: 'Lawn care, trimming and edging, seasonal cleanup, and warm-season property-service messaging.',
  },
];

function normalizedSeason(value) {
  return value === 'warm' ? 'warm' : 'winter';
}

export function WebsitePage() {
  const { selectedCompany, features } = useCompany();
  const feature = features.find((item) => item.key === 'website');
  const [site, setSite] = useState(null);
  const [profile, setProfile] = useState(null);
  const [season, setSeason] = useState('winter');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadWebsite = useCallback(async () => {
    if (!selectedCompany) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const sitePayload = await apiRequest(`/api/admin/business-units/${selectedCompany.id}/site`);
      const nextSite = sitePayload?.data || null;
      setSite(nextSite);

      if (!nextSite?.key) {
        setProfile(null);
        setSeason('winter');
        return;
      }

      const websitePayload = await apiRequest(`/api/admin/sites/${nextSite.key}`);
      const nextProfile = websitePayload?.data?.profile || null;
      setProfile(nextProfile);
      setSeason(normalizedSeason(nextProfile?.metadata?.activeSeason));
    } catch (loadError) {
      setSite(null);
      setProfile(null);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load website settings.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompany]);

  useEffect(() => {
    void loadWebsite();
  }, [loadWebsite]);

  useEffect(() => {
    setSite(null);
    setProfile(null);
    setSeason('winter');
    setSuccess('');
    setError('');
  }, [selectedCompany?.id]);

  const selectedSeason = useMemo(
    () => SEASONS.find((item) => item.value === season) || SEASONS[0],
    [season],
  );

  if (!selectedCompany || !feature?.enabled) {
    return <Navigate to="/dashboard" replace />;
  }

  async function saveSeason() {
    if (!site?.key || !profile) return;
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await apiRequest(`/api/admin/sites/${site.key}/profile`, {
        method: 'PUT',
        body: JSON.stringify({
          brandName: profile.brandName || selectedCompany.name,
          tagline: profile.tagline ?? null,
          description: profile.description ?? null,
          logoUrl: profile.logoUrl ?? null,
          faviconUrl: profile.faviconUrl ?? null,
          contactEmail: profile.contactEmail ?? null,
          contactPhone: profile.contactPhone ?? null,
          socialLinks: profile.socialLinks || {},
          metadata: {
            ...(profile.metadata || {}),
            activeSeason: season,
          },
        }),
      });

      setProfile((current) => current ? {
        ...current,
        metadata: { ...(current.metadata || {}), activeSeason: season },
      } : current);
      setSuccess(`Public website switched to ${selectedSeason.label}.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to update the public website season.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-panel">
      <p className="eyebrow">{selectedCompany.name}</p>
      <div className="page-heading-row">
        <div>
          <h1>Website</h1>
          <p className="page-description">
            Control the selected company&apos;s public website configuration. Seasonal changes are published through the shared backend and do not require a frontend code change.
          </p>
        </div>
        <button className="secondary-button page-action-button" type="button" disabled={loading || saving} onClick={() => void loadWebsite()}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {error && <p className="form-error section-error">{error}</p>}
      {success && <p className="form-success section-error">{success}</p>}

      {!loading && !site && (
        <div className="feature-placeholder">
          <strong>No public website is linked to this business.</strong>
          <p>Create or attach a business-unit website before website settings can be changed here.</p>
        </div>
      )}

      {!loading && site && !profile && (
        <div className="feature-placeholder">
          <strong>The website exists, but its public profile is not configured.</strong>
          <p>The site profile must be created before seasonal settings can be published.</p>
        </div>
      )}

      {!loading && site && profile && (
        <div className="data-section">
          <div className="section-heading-row">
            <div>
              <h2>Seasonal frontend</h2>
              <p className="section-subtitle">
                Choose which service presentation visitors see. The public site reads this setting whenever a page loads.
              </p>
            </div>
            {site.publicUrl && (
              <a className="secondary-button page-action-button" href={site.publicUrl} target="_blank" rel="noreferrer">
                Open website
              </a>
            )}
          </div>

          <div className="schedule-toolbar">
            <div className="schedule-toolbar-actions">
              <label className="filter-field schedule-filter">
                <span>Active season</span>
                <select value={season} disabled={saving} onChange={(event) => {
                  setSeason(event.target.value);
                  setSuccess('');
                }}>
                  {SEASONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="feature-placeholder">
            <strong>{selectedSeason.label}</strong>
            <p>{selectedSeason.description}</p>
            <p>Current public setting: <strong>{normalizedSeason(profile.metadata?.activeSeason) === 'warm' ? 'Spring–Fall' : 'Winter'}</strong>.</p>
          </div>

          <div className="row-button-group" style={{ marginTop: '1rem' }}>
            <button className="primary-button" type="button" disabled={saving || season === normalizedSeason(profile.metadata?.activeSeason)} onClick={() => void saveSeason()}>
              {saving ? 'Publishing…' : 'Publish Season'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
