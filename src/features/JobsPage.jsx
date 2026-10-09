import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext.jsx';
import { apiRequest } from '../lib/api.js';

const JOB_STATUSES = [
  { value: '', label: 'All jobs' },
  { value: 'draft', label: 'Needs scheduling' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function statusLabel(value) {
  return JOB_STATUSES.find((item) => item.value === value)?.label || value;
}

function statusClass(value) {
  if (value === 'draft') return 'requested';
  if (value === 'in_progress') return 'confirmed';
  return value;
}

function formatDateTime(value) {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

const emptyJob = { customerId: '', workOrderNumber: '', title: '', description: '',
  assignedEmployeeId: '', scheduledStart: '', scheduledEnd: '', notes: '' };
function asIso(value) { return value ? new Date(value).toISOString() : null; }

export function JobsPage() {
  const { selectedCompany, features } = useCompany();
  const feature = features.find((item) => item.key === 'work_orders');
  const [jobs, setJobs] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [jobForm, setJobForm] = useState(emptyJob);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadJobs = useCallback(async () => {
    if (!selectedCompany) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '200' });
      if (statusFilter) params.set('status', statusFilter);
      if (search.trim()) params.set('search', search.trim());
      const payload = await apiRequest(`/api/admin/business-units/${selectedCompany.id}/work-orders?${params}`);
      setJobs(Array.isArray(payload?.data) ? payload.data : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load jobs.');
    } finally {
      setLoading(false);
    }
  }, [selectedCompany, statusFilter, search]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    setStatusFilter('');
    setSearch('');
    setSuccess('');
  }, [selectedCompany?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedCompany) { setEmployees([]); setCustomers([]); return; }
    Promise.all([
      apiRequest(`/api/admin/business-units/${selectedCompany.id}/employees?limit=200&status=active`),
      apiRequest(`/api/admin/business-units/${selectedCompany.id}/customers?limit=200`),
    ]).then(([staff, clients]) => {
      if (cancelled) return;
      setEmployees(Array.isArray(staff.data) ? staff.data : []);
      setCustomers(Array.isArray(clients.data) ? clients.data : []);
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load employees and customers.');
    });
    return () => { cancelled = true; };
  }, [selectedCompany?.id]);

  const counts = useMemo(() => ({
    active: jobs.filter((job) => ['draft', 'scheduled', 'in_progress'].includes(job.status)).length,
    scheduled: jobs.filter((job) => job.status === 'scheduled').length,
    inProgress: jobs.filter((job) => job.status === 'in_progress').length,
    completed: jobs.filter((job) => job.status === 'completed').length,
  }), [jobs]);

  if (!selectedCompany || !feature?.enabled) {
    return <Navigate to="/dashboard" replace />;
  }

  async function assignEmployee(job, assignedEmployeeId) {
    setBusyId(job.id); setError(''); setSuccess('');
    try {
      await apiRequest(`/api/admin/business-units/${selectedCompany.id}/work-orders/${job.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ assignedEmployeeId: assignedEmployeeId || null }),
      });
      await loadJobs();
      setSuccess(`${job.workOrderNumber} assignment updated.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign employee.');
    } finally { setBusyId(''); }
  }

  async function createManualJob(event) {
    event.preventDefault();
    setBusyId('create'); setError(''); setSuccess('');
    try {
      const payload = {
        customerId: jobForm.customerId,
        workOrderNumber: jobForm.workOrderNumber.trim(),
        title: jobForm.title.trim(),
        description: jobForm.description.trim() || null,
        assignedEmployeeId: jobForm.assignedEmployeeId || null,
        scheduledStart: asIso(jobForm.scheduledStart),
        scheduledEnd: asIso(jobForm.scheduledEnd),
        status: jobForm.scheduledStart ? 'scheduled' : 'draft',
        notes: jobForm.notes.trim() || null,
      };
      if (payload.scheduledStart && payload.scheduledEnd && payload.scheduledEnd < payload.scheduledStart) {
        throw new Error('Job end cannot precede the start.');
      }
      await apiRequest(`/api/admin/business-units/${selectedCompany.id}/work-orders`, {
        method: 'POST', body: JSON.stringify(payload),
      });
      setJobForm({ ...emptyJob }); setShowCreate(false);
      await loadJobs();
      setSuccess('Job created. Employee assignment is recorded.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create job.'); }
    finally { setBusyId(''); }
  }

  async function updateJobStatus(job, status) {
    setBusyId(job.id);
    setError('');
    setSuccess('');
    try {
      await apiRequest(`/api/admin/business-units/${selectedCompany.id}/work-orders/${job.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadJobs();
      setSuccess(`${job.workOrderNumber} is now ${statusLabel(status).toLowerCase()}.`);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update the job.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="page-panel">
      <p className="eyebrow">{selectedCompany.name}</p>
      <div className="page-heading-row">
        <div>
          <h1>Jobs</h1>
          <p className="page-description">
            Approved customer service requests become jobs here. Scheduled jobs stay linked to the operating calendar and customer request status.
          </p>
        </div>
        <div className="row-button-group">
          <button className="primary-button page-action-button" type="button" onClick={() => setShowCreate(true)}>Create job</button>
          <button className="secondary-button page-action-button" type="button" disabled={loading} onClick={() => void loadJobs()}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {showCreate && (
        <form className="management-card employee-form" onSubmit={createManualJob}>
          <h2>New work order</h2>
          <p className="section-subtitle">Jobs can be created manually or from approved customer requests. Choose an existing customer first.</p>
          <div className="employee-form-grid">
            <label className="field-label">Customer
              <select required value={jobForm.customerId} onChange={(e) => setJobForm({ ...jobForm, customerId: e.target.value })}>
                <option value="">Select customer</option>
                {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName}</option>)}
              </select>
            </label>
            <label className="field-label">Job number
              <input required maxLength={80} value={jobForm.workOrderNumber} onChange={(e) => setJobForm({ ...jobForm, workOrderNumber: e.target.value })} placeholder="POS-2026-001" />
            </label>
            <label className="field-label">Job title
              <input required maxLength={200} value={jobForm.title} onChange={(e) => setJobForm({ ...jobForm, title: e.target.value })} placeholder="Driveway snow clearing" />
            </label>
            <label className="field-label">Assign employee
              <select value={jobForm.assignedEmployeeId} onChange={(e) => setJobForm({ ...jobForm, assignedEmployeeId: e.target.value })}>
                <option value="">Unassigned</option>
                {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.displayName}</option>)}
              </select>
            </label>
            <label className="field-label">Scheduled start
              <input type="datetime-local" value={jobForm.scheduledStart} onChange={(e) => setJobForm({ ...jobForm, scheduledStart: e.target.value })} />
            </label>
            <label className="field-label">Scheduled end
              <input type="datetime-local" value={jobForm.scheduledEnd} onChange={(e) => setJobForm({ ...jobForm, scheduledEnd: e.target.value })} />
            </label>
          </div>
          <label className="field-label">Instructions<textarea rows={3} maxLength={5000} value={jobForm.description} onChange={(e) => setJobForm({ ...jobForm, description: e.target.value })} /></label>
          <label className="field-label">Internal notes<textarea rows={2} maxLength={5000} value={jobForm.notes} onChange={(e) => setJobForm({ ...jobForm, notes: e.target.value })} /></label>
          <div className="row-button-group">
            <button className="primary-button" type="submit" disabled={busyId === 'create' || !customers.length}>Create work order</button>
            <button className="secondary-button" type="button" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </form>
      )}
      <div className="schedule-summary">
        <article><span>Active</span><strong>{counts.active}</strong><small>open jobs</small></article>
        <article><span>Scheduled</span><strong>{counts.scheduled}</strong><small>ready to work</small></article>
        <article><span>In progress</span><strong>{counts.inProgress}</strong><small>currently underway</small></article>
        <article><span>Completed</span><strong>{counts.completed}</strong><small>in this view</small></article>
      </div>

      <div className="schedule-toolbar">
        <div className="schedule-toolbar-actions">
          <label className="filter-field schedule-filter">
            <span>Status</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {JOB_STATUSES.map((option) => <option key={option.value || 'all'} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="filter-field schedule-filter">
            <span>Search</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Job #, customer, or title" />
          </label>
        </div>
      </div>

      {error && <p className="form-error section-error">{error}</p>}
      {success && <p className="form-success section-error">{success}</p>}

      <div className="data-section">
        <div className="section-heading-row">
          <div>
            <h2>Job queue</h2>
            <p className="section-subtitle">Requests with a requested time are created as scheduled jobs. Requests without a time remain in Needs scheduling until they are scheduled.</p>
          </div>
          <span className="record-count">{jobs.length} shown</span>
        </div>

        <div className="table-wrap">
          <table className="feature-table">
            <thead>
              <tr><th>Job</th><th>Customer</th><th>Schedule</th><th>Assigned employee</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    <strong className="table-primary">{job.workOrderNumber}</strong>
                    <span className="table-secondary">{job.title}</span>
                  </td>
                  <td><strong className="table-primary">{job.customerName || 'Customer'}</strong></td>
                  <td>
                    <strong className="table-primary">{formatDateTime(job.scheduledStart)}</strong>
                    {job.scheduledEnd && <span className="table-secondary">Ends {formatDateTime(job.scheduledEnd)}</span>}
                    {job.scheduleEntryId && <span className="table-secondary">Linked to operating calendar</span>}
                  </td>
                  <td>
                    <select aria-label={`Assigned employee for ${job.workOrderNumber}`} value={job.assignedEmployeeId || ''} disabled={busyId === job.id}
                      onChange={(event) => void assignEmployee(job, event.target.value)}>
                      <option value="">Unassigned</option>
                      {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.displayName}</option>)}
                      {job.assignedEmployeeId && !employees.some((employee) => employee.id === job.assignedEmployeeId) &&
                        <option value={job.assignedEmployeeId}>Inactive/previous assignment</option>}
                    </select>
                  </td>
                  <td><span className={`status-pill ${statusClass(job.status)}`}>{statusLabel(job.status)}</span></td>
                  <td>
                    <div className="row-button-group">
                      {job.status === 'draft' && <span className="table-secondary">Schedule required</span>}
                      {job.status === 'scheduled' && (
                        <button className="primary-button compact-button" type="button" disabled={busyId === job.id} onClick={() => void updateJobStatus(job, 'in_progress')}>Start job</button>
                      )}
                      {job.status === 'in_progress' && (
                        <button className="primary-button compact-button" type="button" disabled={busyId === job.id} onClick={() => void updateJobStatus(job, 'completed')}>Complete</button>
                      )}
                      {['draft', 'scheduled', 'in_progress'].includes(job.status) && (
                        <button className="secondary-button compact-button" type="button" disabled={busyId === job.id} onClick={() => void updateJobStatus(job, 'cancelled')}>Cancel</button>
                      )}
                      {['completed', 'cancelled'].includes(job.status) && <span className="table-secondary">No action required</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && jobs.length === 0 && <tr><td colSpan="6" className="empty-cell">No jobs match this filter.</td></tr>}
              {loading && jobs.length === 0 && <tr><td colSpan="6" className="empty-cell">Loading jobs…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
