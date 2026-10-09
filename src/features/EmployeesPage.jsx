import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext.jsx';
import { apiRequest } from '../lib/api.js';

const emptyEmployee = {
  displayName: '', email: '', phone: '', employeeNumber: '',
  jobTitle: '', hireDate: '', notes: '',
};
const statuses = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'terminated', label: 'Terminated' },
];
const toNullable = (value) => (value?.trim() ? value.trim() : null);

export function EmployeesPage() {
  const { selectedCompany } = useCompany();
  const businessUnitId = selectedCompany?.id;
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [form, setForm] = useState(emptyEmployee);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    if (!businessUnitId) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (filter) params.set('status', filter);
      if (search.trim()) params.set('search', search.trim());
      const response = await apiRequest(`/api/admin/business-units/${businessUnitId}/employees?${params}`);
      setEmployees(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Employees could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [businessUnitId, filter, search]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setEditing(null); setShowForm(false); setSuccess(''); setSearch(''); setFilter('');
  }, [businessUnitId]);

  if (!selectedCompany) return <Navigate to="/companies" replace />;

  function openCreate() {
    setEditing(null); setForm({ ...emptyEmployee }); setShowForm(true); setError(''); setSuccess('');
  }
  function openEdit(employee) {
    setEditing(employee);
    setForm({
      displayName: employee.displayName || '', email: employee.email || '',
      phone: employee.phone || '', employeeNumber: employee.employeeNumber || '',
      jobTitle: employee.jobTitle || '', hireDate: employee.hireDate?.slice(0, 10) || '',
      notes: employee.notes || '',
    });
    setShowForm(true); setError(''); setSuccess('');
  }
  function payloadFromForm() {
    return {
      displayName: form.displayName.trim(), email: toNullable(form.email),
      phone: toNullable(form.phone), employeeNumber: toNullable(form.employeeNumber),
      jobTitle: toNullable(form.jobTitle), hireDate: toNullable(form.hireDate),
      notes: toNullable(form.notes),
    };
  }
  async function save(event) {
    event.preventDefault();
    setBusy('save'); setError(''); setSuccess('');
    try {
      const base = `/api/admin/business-units/${businessUnitId}/employees`;
      await apiRequest(editing ? `${base}/${editing.id}` : base, {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payloadFromForm()),
      });
      setSuccess(editing ? 'Employee record updated.' : 'Employee added. Issue an account invitation when ready.');
      setShowForm(false); setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save employee.');
    } finally { setBusy(''); }
  }
  async function changeStatus(employee, status) {
    if (status === 'terminated' && !window.confirm(`Terminate ${employee.displayName} in this business? This does not automatically revoke login sessions.`)) return;
    setBusy(employee.id); setError(''); setSuccess('');
    try {
      await apiRequest(`/api/admin/business-units/${businessUnitId}/employees/${employee.id}`, {
        method: 'PATCH', body: JSON.stringify({ status }),
      });
      setSuccess(`${employee.displayName} is now ${status}.`);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Status update failed.'); }
    finally { setBusy(''); }
  }
  async function accountAction(employee, action) {
    const confirmation = action === 'invite'
      ? `Issue a one-time account setup email to ${employee.email}?\nExisting employee accounts receive a new reset link.`
      : `Send a password reset email for ${employee.displayName}?`;
    if (!window.confirm(confirmation)) return;
    setBusy(employee.id); setError(''); setSuccess('');
    try {
      await apiRequest(`/api/admin/business-units/${businessUnitId}/employees/${employee.id}/${action === 'invite' ? 'invite' : 'password-reset'}`, { method: 'POST' });
      setSuccess(`Account email request accepted for ${employee.displayName}. Check outbound email delivery before considering it sent.`);
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Account operation failed.'); }
    finally { setBusy(''); }
  }

  return (
    <section className="page-panel employees-page">
      <p className="eyebrow">{selectedCompany.name}</p>
      <div className="page-heading-row">
        <div>
          <h1>Employees</h1>
          <p className="page-description">Maintain staff records, create employee-only login accounts and issue password reset emails.</p>
        </div>
        <button className="primary-button page-action-button" type="button" onClick={openCreate}>Add employee</button>
      </div>
      {error && <p className="form-error section-error" role="alert">{error}</p>}
      {success && <p className="form-success section-error" role="status">{success}</p>}
      {showForm && (
        <form className="management-card employee-form" onSubmit={save}>
          <h2>{editing ? 'Edit employee' : 'New employee'}</h2>
          <div className="employee-form-grid">
            <label className="field-label">Full name<input required maxLength={200} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></label>
            <label className="field-label">Email address<input type="email" maxLength={254} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            <label className="field-label">Phone<input maxLength={80} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="field-label">Employee number<input maxLength={80} value={form.employeeNumber} onChange={(e) => setForm({ ...form, employeeNumber: e.target.value })} /></label>
            <label className="field-label">Job title<input maxLength={160} value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} /></label>
            <label className="field-label">Hire date<input type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })} /></label>
          </div>
          <label className="field-label">Internal notes<textarea maxLength={5000} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <div className="row-button-group management-form-actions">
            <button className="primary-button" type="submit" disabled={busy === 'save' || !form.displayName.trim()}>{busy === 'save' ? 'Saving…' : 'Save employee'}</button>
            <button className="secondary-button" type="button" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}
      <div className="schedule-toolbar employee-toolbar">
        <div className="schedule-toolbar-actions employee-toolbar-actions">
          <label className="filter-field schedule-filter employee-filter"><span>Status</span>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">All Employees</option>{statuses.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="filter-field schedule-filter employee-filter employee-search-filter"><span>Search employees</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, email, employee #" />
          </label>
          <button className="secondary-button employee-refresh-button" type="button" onClick={() => void load()} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh list'}</button>
        </div>
      </div>
      <div className="data-section">
        <div className="section-heading-row"><h2>Employee directory</h2><span className="record-count">{employees.length} shown</span></div>
        <div className="table-wrap">
          <table className="feature-table employee-directory-table">
            <thead><tr><th>Employee</th><th>Contact</th><th>Status</th><th>Login</th><th>Actions</th></tr></thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td><strong className="table-primary">{employee.displayName}</strong><span className="table-secondary">{employee.jobTitle || employee.employeeNumber || 'Employee'}</span></td>
                  <td><span className="table-primary">{employee.email || 'No email'}</span><span className="table-secondary">{employee.phone || ''}</span></td>
                  <td className="employee-status-cell">
                    <select className="employee-status-select" aria-label={`Status of ${employee.displayName}`} value={employee.status} disabled={busy === employee.id}
                      onChange={(e) => void changeStatus(employee, e.target.value)}>
                      {statuses.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </td>
                  <td className="employee-login-cell">
                    <span className={`employee-login-indicator ${employee.userId ? 'linked' : 'not-linked'}`}>
                      {employee.userId ? 'Account linked' : 'No account'}
                    </span>
                  </td>
                  <td className="employee-actions-cell">
                    <div className="employee-row-actions">
                      <button className="secondary-button compact-button" type="button" disabled={!!busy} onClick={() => openEdit(employee)}>Edit</button>
                      {employee.status === 'active' && !!employee.email && (
                        <button className="secondary-button compact-button employee-account-button" type="button" disabled={!!busy}
                          onClick={() => void accountAction(employee, employee.userId ? 'reset' : 'invite')}>
                          {employee.userId ? 'Send reset' : 'Create login'}
                        </button>
                      )}
                    </div>
                    {employee.status === 'active' && !employee.email && (
                      <span className="table-secondary employee-action-hint">Add an email to enable login</span>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && employees.length === 0 && <tr><td colSpan={5} className="empty-cell">No matching employees. Add your first employee to begin.</td></tr>}
              {loading && <tr><td colSpan={5} className="empty-cell">Loading employees…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
