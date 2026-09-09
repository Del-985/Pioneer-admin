import { useState } from 'react';
import { useCompany } from '../context/CompanyContext.jsx';

export function CompanyFeaturesPanel() {
  const {
    selectedCompany,
    features,
    featureStatus,
    featureError,
    setFeatureEnabled,
  } = useCompany();
  const [savingKey, setSavingKey] = useState('');
  const [actionError, setActionError] = useState('');

  const visibleFeatures = features.filter((feature) => feature.key !== 'website');

  if (!selectedCompany) {
    return (
      <div className="data-section">
        <h2>Company features</h2>
        <p className="empty-copy">Select a company above to configure which shared modules it uses.</p>
      </div>
    );
  }

  async function handleToggle(feature) {
    setSavingKey(feature.key);
    setActionError('');
    try {
      await setFeatureEnabled(feature.key, !feature.enabled);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update the feature.');
    } finally {
      setSavingKey('');
    }
  }

  return (
    <div className="data-section">
      <div className="section-heading-row">
        <div>
          <h2>Company features</h2>
          <p className="section-subtitle">
            Shared modules enabled for {selectedCompany.name}. Each module uses the same application code,
            while this company&apos;s configuration determines whether it appears and how it behaves.
          </p>
        </div>
      </div>

      {(featureError || actionError) && (
        <p className="form-error section-error">{actionError || featureError}</p>
      )}

      {featureStatus === 'loading' ? (
        <p className="loading-copy">Loading feature configuration…</p>
      ) : (
        <div className="feature-config-grid">
          {visibleFeatures.map((feature) => (
            <article className="feature-config-card" key={feature.key}>
              <div>
                <span className="feature-category">{feature.category}</span>
                <h3>{feature.name}</h3>
                <p>{feature.description}</p>
              </div>
              <button
                className={`feature-toggle ${feature.enabled ? 'enabled' : ''}`}
                type="button"
                aria-pressed={feature.enabled}
                disabled={savingKey === feature.key}
                onClick={() => handleToggle(feature)}
              >
                {savingKey === feature.key
                  ? 'Saving…'
                  : feature.enabled
                    ? 'Enabled'
                    : 'Disabled'}
              </button>
            </article>
          ))}
          {featureStatus === 'ready' && visibleFeatures.length === 0 && (
            <p className="empty-copy">No feature definitions are available.</p>
          )}
        </div>
      )}
    </div>
  );
}
