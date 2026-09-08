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

  useEffect(() => {
    let cancelled = false;

    if (authStatus !== 'authenticated') {
      setCompanies([]);
      setStatus(authStatus === 'checking' ? 'loading' : 'idle');
      setError('');
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
        setError(loadError instanceof Error ? loadError.message : 'Unable to load companies.');
        setStatus('error');
      }
    }

    loadCompanies();
    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  function selectCompany(companyId) {
    setSelectedCompanyId(companyId);
    if (companyId) localStorage.setItem(STORAGE_KEY, companyId);
    else localStorage.removeItem(STORAGE_KEY);
  }

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) || null,
    [companies, selectedCompanyId],
  );

  const value = useMemo(
    () => ({ companies, selectedCompany, selectedCompanyId, selectCompany, status, error }),
    [companies, selectedCompany, selectedCompanyId, status, error],
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const context = useContext(CompanyContext);
  if (!context) throw new Error('useCompany must be used inside CompanyProvider.');
  return context;
}
