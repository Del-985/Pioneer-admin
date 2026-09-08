import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const STORAGE_KEY = 'pioneer-admin.active-company-id';
const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const { status: authStatus } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [features, setFeatures] = useState([]);
  const [featureStatus, setFeatureStatus] = useState('idle');
  const [featureError, setFeatureError] = useState('');

  useEffect(() => {
    let cancelled = false;

    if (authStatus !== 'authenticated') {
      setCompanies([]);
      setFeatures([]);
      setStatus(authStatus === 'checking' ? 'loading' : 'idle');
      setFeatureStatus('idle');
      setError('');
      setFeatureError('');
      return () => {
        cancelled = true;
      };
    }

    async function loadCompanies() {
      setStatus('loading');

      try {
        const payload = await apiRequest('/api/admin/business-units');
        if (cancelled) return;

        const nextCompanies = Array.isArray(payload?.data) ? payload.data : [];
        setCompanies(nextCompanies);
        setError('');
        setStatus('ready');

        setSelectedCompanyId((currentId) => {
          if (currentId && nextCompanies.some((company) => company.id === currentId)) {
            return currentId;
          }

          const nextId = nextCompanies.length === 1 ? nextCompanies[0].id : '';
          if (nextId) localStorage.setItem(STORAGE_KEY, nextId);
          else localStorage.removeItem(STORAGE_KEY);
          return nextId;
        });
      } catch (loadError) {
        if (cancelled) return;
        setCompanies([]);
        setFeatures([]);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load companies.');
        setStatus('error');
      }
    }

    loadCompanies();
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  useEffect(() => {
    let cancelled = false;

    if (authStatus !== 'authenticated' || !selectedCompanyId) {
      setFeatures([]);
      setFeatureError('');
      setFeatureStatus('idle');
      return () => {
        cancelled = true;
      };
    }

    async function loadFeatures() {
      setFeatureStatus('loading');
      try {
        const payload = await apiRequest(`/api/admin/business-units/${selectedCompanyId}/features`);
        if (cancelled) return;
        setFeatures(Array.isArray(payload?.data) ? payload.data : []);
        setFeatureError('');
        setFeatureStatus('ready');
      } catch (loadError) {
        if (cancelled) return;
        setFeatures([]);
        setFeatureError(loadError instanceof Error ? loadError.message : 'Unable to load company features.');
        setFeatureStatus('error');
      }
    }

    loadFeatures();
    return () => {
      cancelled = true;
    };
  }, [authStatus, selectedCompanyId]);

  function selectCompany(companyId) {
    setSelectedCompanyId(companyId);
    if (companyId) localStorage.setItem(STORAGE_KEY, companyId);
    else localStorage.removeItem(STORAGE_KEY);
  }

  async function setFeatureEnabled(featureKey, enabled) {
    if (!selectedCompanyId) throw new Error('Select a company before changing features.');
    const currentFeature = features.find((feature) => feature.key === featureKey);
    if (!currentFeature) throw new Error('Feature configuration is not available.');

    const payload = await apiRequest(`/api/admin/business-units/${selectedCompanyId}/features`, {
      method: 'PUT',
      body: JSON.stringify({
        features: [{
          key: featureKey,
          enabled,
          config: currentFeature.config || {},
        }],
      }),
    });

    const nextFeatures = Array.isArray(payload?.data) ? payload.data : [];
    setFeatures(nextFeatures);
    return nextFeatures;
  }

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) || null,
    [companies, selectedCompanyId],
  );

  const enabledFeatures = useMemo(
    () => features.filter((feature) => feature.enabled),
    [features],
  );

  const value = useMemo(
    () => ({
      companies,
      selectedCompany,
      selectedCompanyId,
      selectCompany,
      status,
      error,
      features,
      enabledFeatures,
      featureStatus,
      featureError,
      setFeatureEnabled,
    }),
    [
      companies,
      selectedCompany,
      selectedCompanyId,
      status,
      error,
      features,
      enabledFeatures,
      featureStatus,
      featureError,
    ],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) throw new Error('useCompany must be used inside CompanyProvider.');
  return context;
}
