import { useEffect, useState } from 'react';
import { NavLink, Navigate, useParams } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext.jsx';
import { apiRequest } from '../lib/api.js';
import PayrollAdmin from './PayrollAdmin.jsx';
import PayrollProvider from './PayrollProvider.jsx';
import PayrollNative from './PayrollNative.jsx';
import TimekeepingAdmin from './TimekeepingAdmin.jsx';

const sections = [
  { key: 'hours', label: 'Hours & Timesheets', description: 'Clock records, corrections, and manager approval' },
  { key: 'registers', label: 'Pay Registers', description: 'Calculate and approve gross wage estimates' },
  { key: 'native', label: 'Native Payroll', description: 'Internal earnings calculations, adjustments and documented deduction rules' },
  { key: 'provider', label: 'Payroll Provider (Legacy)', description: 'Optional CSV backup handoff to external payroll services' },
  { key: 'rates', label: 'Pay Rates', description: 'Employee rates and effective dates' },
  { key: 'adjustments', label: 'Adjustments', description: 'Bonuses, reimbursements, and corrections' },
  { key: 'labor', label: 'Labor Costs', description: 'Job-linked gross wage costs' },
  { key: 'accounts', label: 'Books Accounts', description: 'Payroll expense and liability accounts' },
];
const validSections = new Set(sections.map(section => section.key));
const errorText = error => error instanceof Error ? error.message : 'Unable to load payroll information.';

/**
 * Payroll is its own business workspace, not a Field Operations tab.
 * The URL identifies each section so links, reloads and future sections
 * remain stable. All actual payroll authorization remains on the API.
 */
export function PayrollPage() {
  const { selectedCompany } = useCompany();
  const { section = 'hours' } = useParams();
  const businessUnitId = selectedCompany?.id;
  const [staff, setStaff] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setStaff([]);
    setJobs([]);
    setShifts([]);
    setError('');
    if (!businessUnitId || !validSections.has(section)) return;

    const base = '/api/admin/business-units/' + businessUnitId;
    setLoading(true);
    const requests = [
      apiRequest(base + '/employees?limit=200&status=active'),
    ];
    if (section === 'hours') {
      requests.push(apiRequest(base + '/work-orders?limit=200'));
      requests.push(apiRequest(base + '/field/shifts'));
    }
    Promise.all(requests)
      .then(([employeeResponse, jobResponse, shiftResponse]) => {
        if (!active) return;
        setStaff(Array.isArray(employeeResponse.data) ? employeeResponse.data : []);
        setJobs(Array.isArray(jobResponse?.data) ? jobResponse.data : []);
        setShifts(Array.isArray(shiftResponse?.data) ? shiftResponse.data : []);
      })
      .catch(cause => {
        if (active) setError(errorText(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [businessUnitId, section]);

  if (!validSections.has(section)) {
    return <Navigate to="/payroll/hours" replace />;
  }
  if (!businessUnitId) {
    return (
      <section className="page-panel">
        <p className="eyebrow">Business administration</p>
        <h1>Payroll</h1>
        <p className="page-description">Select a business to manage employee hours, pay rates, and payroll records.</p>
      </section>
    );
  }

  const activeSection = sections.find(item => item.key === section);
  return (
    <section className="page-panel payroll-workspace">
      <header className="payroll-workspace-heading">
        <div>
          <p className="eyebrow">{selectedCompany.name}</p>
          <h1>Payroll</h1>
          <p className="page-description">
            Review employee time, prepare gross wage records, manage adjustments,
            and connect labor costs with Pioneer Books.
          </p>
        </div>
      </header>

      <nav className="payroll-workspace-nav" aria-label="Payroll sections">
        {sections.map(item => (
          <NavLink
            key={item.key}
            to={'/payroll/' + item.key}
            className={({ isActive }) => 'payroll-workspace-link' + (isActive ? ' active' : '')}
            aria-label={item.label}
          >{item.label}</NavLink>
        ))}
      </nav>

      <div className="payroll-workspace-section">
        <div className="payroll-section-caption">
          <span className="eyebrow">Payroll / {activeSection.label}</span>
          <p>{activeSection.description}</p>
        </div>
        {loading && <p className="loading-copy" role="status">Loading payroll workspace…</p>}
        {error && <p className="form-error section-error" role="alert">{error}</p>}
        {!loading && !error && (
          section === 'hours'
            ? <TimekeepingAdmin
                key={'hours-' + businessUnitId}
                businessUnitId={businessUnitId}
                employees={staff}
                jobs={jobs}
                shifts={shifts}
              />
            : section === 'provider'
              ? <PayrollProvider key={'provider-' + businessUnitId} businessUnitId={businessUnitId}/>
            : section === 'native'
              ? <PayrollNative key={'native-' + businessUnitId} businessUnitId={businessUnitId} employees={staff}/>
              : <PayrollAdmin
                key={businessUnitId + '-' + section}
                businessUnitId={businessUnitId}
                employees={staff}
                section={section === 'registers' ? 'runs' : section}
              />
        )}
      </div>
    </section>
  );
}
