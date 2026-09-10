import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const STORAGE_KEY = 'pioneer-admin.active-business-id';
const LEGACY_STORAGE_KEY = 'pioneer-admin.active-company-id';
const ALL_BUSINESSES_ID = 'all';
const CompanyContext = createContext(null);

export function CompanyProvider({ children }) {
  const { status: authStatus } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState(() => (
    localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY) || ''
  ));
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [features, setFeatures] = useState([]);
  const [featureStatus, setFeatureStatus] = useState('idle');
  const [featureError, setFeatureError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);

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
          const currentIsBusiness = nextCompanies.some((company) => company.id === currentId);
          const currentIsAll = currentId === ALL_BUSINESSES_ID && nextCompanies.length > 1;

          if (currentIsBusiness || currentIsAll) {
            localStorage.setItem(STORAGE_KEY, currentId);
            localStorage.removeItem(LEGACY_STORAGE_KEY);
            return currentId;
          }

          const nextId = nextCompanies.length === 1
            ? nextCompanies[0].id
            : nextCompanies.length > 1
              ? ALL_BUSINESSES_ID
              : '';

          if (nextId) localStorage.setItem(STORAGE_KEY, nextId);
          else localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
          return nextId;
        });
      } catch (loadError) {
        if (cancelled) return;
        setCompanies([]);
        setFeatures([]);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load businesses.');
        setStatus('error');
      }
    }

    void loadCompanies();
    return () => {
      cancelled = true;
    };
  }, [authStatus, refreshVersion]);

  useEffect(() => {
    let cancelled = false;

    if (
      authStatus !== 'authenticated' ||
      !selectedCompanyId ||
      selectedCompanyId === ALL_BUSINESSES_ID
    ) {
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
        setFeatureError(loadError instanceof Error ? loadError.message : 'Unable to load business features.');
        setFeatureStatus('error');
      }
    }

    void loadFeatures();
    return () => {
      cancelled = true;
    };
  }, [authStatus, selectedCompanyId]);

  function selectCompany(companyId) {
    const isAllowed = companyId === '' ||
      (companyId === ALL_BUSINESSES_ID && companies.length > 1) ||
      companies.some((company) => company.id === companyId);

    if (!isAllowed) return;

    setSelectedCompanyId(companyId);
    if (companyId) localStorage.setItem(STORAGE_KEY, companyId);
    else localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }

  function refreshCompanies() {
    setRefreshVersion((version) => version + 1);
  }

  async function setFeatureEnabled(featureKey, enabled) {
    if (!selectedCompanyId || selectedCompanyId === ALL_BUSINESSES_ID) {
      throw new Error('Select a business before changing features.');
    }

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

  const isAllBusinesses = selectedCompanyId === ALL_BUSINESSES_ID;

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) || null,
    [companies, selectedCompanyId],
  );

  const selectedLegalEntity = selectedCompany?.legalEntity || null;

  const enabledFeatures = useMemo(
    () => features.filter((feature) => feature.enabled),
    [features],
  );

  const value = useMemo(
    () => ({
      companies,
      selectedCompany,
      selectedCompanyId,
      selectedLegalEntity,
      isAllBusinesses,
      isReadOnly: isAllBusinesses,
      selectCompany,
      selectBusinessUnit: selectCompany,
      refreshCompanies,
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
      selectedLegalEntity,
      isAllBusinesses,
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
