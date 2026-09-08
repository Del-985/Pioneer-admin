import { useCompany } from '../context/CompanyContext.jsx';

export function CompanySelector() {
  const { companies, selectedCompany, selectedCompanyId, selectCompany, status, error } = useCompany();

  return (
    <div className="company-selector">
      <label htmlFor="company-select">Company</label>
      <select
        id="company-select"
        value={selectedCompanyId}
        onChange={(event) => selectCompany(event.target.value)}
        disabled={status === 'loading' || companies.length === 0}
      >
        <option value="">
          {status === 'loading'
            ? 'Loading companies…'
            : companies.length === 0
              ? 'No companies available'
              : 'Select company'}
        </option>
        {companies.map((company) => (
          <option key={company.id} value={company.id}>
            {company.name}
          </option>
        ))}
      </select>
      {selectedCompany ? (
        <span className="company-selector-context">{selectedCompany.legalEntity.name}</span>
      ) : error ? (
        <span className="company-selector-error">{error}</span>
      ) : null}
    </div>
  );
}
