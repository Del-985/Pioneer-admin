import { useCompany } from '../context/CompanyContext.jsx';

export function CompanySelector() {
  const {
    companies,
    selectedCompany,
    selectedCompanyId,
    isAllBusinesses,
    selectCompany,
    status,
    error,
  } = useCompany();

  const legalEntityName = selectedCompany?.legalEntity?.name;
  const showLegalEntityContext = Boolean(legalEntityName && legalEntityName !== selectedCompany?.name);

  return (
    <>
      <div className="company-selector">
        <label htmlFor="company-select">Business</label>
        <select
          id="company-select"
          value={selectedCompanyId}
          onChange={(event) => selectCompany(event.target.value)}
          disabled={status === 'loading' || companies.length === 0}
        >
          <option value="">
            {status === 'loading'
              ? 'Loading businesses…'
              : companies.length === 0
                ? 'No businesses available'
                : 'Select Business'}
          </option>
          {companies.length > 1 ? <option value="all">All Businesses</option> : null}
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
        {isAllBusinesses ? (
          <span className="company-selector-context">Consolidated View · Read Only</span>
        ) : showLegalEntityContext ? (
          <span className="company-selector-context">{legalEntityName}</span>
        ) : error ? (
          <span className="company-selector-error">{error}</span>
        ) : null}
      </div>
      <a className="text-button" href="https://books.pioneerlegacyworks.com">Bookkeeping</a>
    </>
  );
}
