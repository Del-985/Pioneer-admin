import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext.jsx';
import { apiRequest } from '../lib/api.js';

const emptyForm = {
  displayName: '',
  companyName: '',
  contactName: '',
  email: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  postalCode: '',
  notes: '',
  status: 'active',
};

function formFromCustomer(customer) {
  return {
    displayName: customer.displayName || '',
    companyName: customer.companyName || '',
    contactName: customer.contactName || '',
    email: customer.email || '',
    phone: customer.phone || '',
    addressLine1: customer.addressLine1 || '',
    addressLine2: customer.addressLine2 || '',
    city: customer.city || '',
    state: customer.state || '',
    postalCode: customer.postalCode || '',
    notes: customer.notes || '',
    status: customer.status || 'active',
  };
}

function nullable(value) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function CustomersPage() {
  const { selectedCompany, features } = useCompany();
  const feature = features.find((item) => item.key === 'customers');
  const [customers, setCustomers] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const endpoint = useMemo(() => {
    if (!selectedCompany) return '';
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (search) params.set('search', search);
    const query = params.toString();
    return `/api/admin/business-units/${selectedCompany.id}/customers${query ? `?${query}` : ''}`;
  }, [selectedCompany, statusFilter, search]);

  const loadCustomers = useCallback(async () => {
    if (!endpoint) return;
    setLoading(true);
    try {
      const payload = await apiRequest(endpoint);
      setCustomers(Array.isArray(payload?.data) ? payload.data : []);
      setError('');
    } catch (loadError) {
      setCustomers([]);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load customers.');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  useEffect(() => {
    setEditorOpen(false);
    setEditingCustomer(null);
    setForm(emptyForm);
  }, [selectedCompany?.id]);

  if (!selectedCompany || !feature?.enabled) {
    return <Navigate to="/dashboard" replace />;
  }

  function openCreate() {
    setEditingCustomer(null);
    setForm(emptyForm);
    setEditorOpen(true);
  }

  function openEdit(customer) {
    setEditingCustomer(customer);
    setForm(formFromCustomer(customer));
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditingCustomer(null);
    setForm(emptyForm);
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submitCustomer(event) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      displayName: form.displayName.trim(),
      companyName: nullable(form.companyName),
      contactName: nullable(form.contactName),
      email: nullable(form.email),
      phone: nullable(form.phone),
      addressLine1: nullable(form.addressLine1),
      addressLine2: nullable(form.addressLine2),
      city: nullable(form.city),
      state: nullable(form.state),
      postalCode: nullable(form.postalCode),
      notes: nullable(form.notes),
      status: form.status,
    };

    try {
      if (editingCustomer) {
        await apiRequest(
          `/api/admin/business-units/${selectedCompany.id}/customers/${editingCustomer.id}`,
          { method: 'PATCH', body: JSON.stringify(payload) },
        );
      } else {
        await apiRequest(`/api/admin/business-units/${selectedCompany.id}/customers`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      closeEditor();
      await loadCustomers();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save customer.');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(customer, status) {
    setBusyId(customer.id);
    try {
      const payload = await apiRequest(
        `/api/admin/business-units/${selectedCompany.id}/customers/${customer.id}`,
        { method: 'PATCH', body: JSON.stringify({ status }) },
      );
      setCustomers((current) => current.map((item) => (
        item.id === customer.id ? payload.data : item
      )));
      setError('');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update customer.');
    } finally {
      setBusyId('');
    }
  }

  function submitSearch(event) {
    event.preventDefault();
    setSearch(searchInput.trim());
  }

  return (
    <section className="page-panel">
      <p className="eyebrow">{selectedCompany.name}</p>
      <div className="page-heading-row">
        <div>
          <h1>Customers</h1>
          <p className="page-description">Customer records owned by this company.</p>
        </div>
        <button className="primary-button page-action-button" type="button" onClick={openCreate}>
          Add customer
        </button>
      </div>

      <div className="feature-toolbar">
        <form className="search-form" onSubmit={submitSearch}>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search customer, company, email, phone…"
            aria-label="Search customers"
          />
          <button className="secondary-button" type="submit">Search</button>
          {(search || searchInput) && (
            <button
              className="text-button"
              type="button"
              onClick={() => {
                setSearchInput('');
                setSearch('');
              }}
            >
              Clear
            </button>
          )}
        </form>

        <label className="filter-field">
          <span>Status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
      </div>

      {error && <p className="form-error section-error">{error}</p>}

      {editorOpen && (
        <form className="customer-editor" onSubmit={submitCustomer}>
          <div className="editor-heading">
            <div>
              <span className="editor-kicker">{editingCustomer ? 'Edit customer' : 'New customer'}</span>
              <h2>{editingCustomer?.displayName || 'Customer details'}</h2>
            </div>
            <button className="text-button" type="button" onClick={closeEditor}>Close</button>
          </div>

          <div className="form-grid">
            <label className="form-field full-width">
              <span>Display name</span>
              <input
                value={form.displayName}
                onChange={(event) => updateForm('displayName', event.target.value)}
                required
              />
            </label>
            <label className="form-field">
              <span>Company / organization</span>
              <input value={form.companyName} onChange={(event) => updateForm('companyName', event.target.value)} />
            </label>
            <label className="form-field">
              <span>Primary contact</span>
              <input value={form.contactName} onChange={(event) => updateForm('contactName', event.target.value)} />
            </label>
            <label className="form-field">
              <span>Email</span>
              <input type="email" value={form.email} onChange={(event) => updateForm('email', event.target.value)} />
            </label>
            <label className="form-field">
              <span>Phone</span>
              <input value={form.phone} onChange={(event) => updateForm('phone', event.target.value)} />
            </label>
            <label className="form-field full-width">
              <span>Address</span>
              <input value={form.addressLine1} onChange={(event) => updateForm('addressLine1', event.target.value)} />
            </label>
            <label className="form-field full-width">
              <span>Address line 2</span>
              <input value={form.addressLine2} onChange={(event) => updateForm('addressLine2', event.target.value)} />
            </label>
            <label className="form-field">
              <span>City</span>
              <input value={form.city} onChange={(event) => updateForm('city', event.target.value)} />
            </label>
            <label className="form-field">
              <span>State</span>
              <input value={form.state} onChange={(event) => updateForm('state', event.target.value)} />
            </label>
            <label className="form-field">
              <span>Postal code</span>
              <input value={form.postalCode} onChange={(event) => updateForm('postalCode', event.target.value)} />
            </label>
            <label className="form-field">
              <span>Status</span>
              <select value={form.status} onChange={(event) => updateForm('status', event.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
            <label className="form-field full-width">
              <span>Notes</span>
              <textarea rows="4" value={form.notes} onChange={(event) => updateForm('notes', event.target.value)} />
            </label>
          </div>

          <div className="editor-actions">
            <button className="secondary-button" type="button" onClick={closeEditor}>Cancel</button>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingCustomer ? 'Save changes' : 'Create customer'}
            </button>
          </div>
        </form>
      )}

      <div className="data-section">
        <div className="table-wrap">
          <table className="feature-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer.id}>
                  <td>
                    <strong className="table-primary">{customer.displayName}</strong>
                    {customer.companyName && <span className="table-secondary">{customer.companyName}</span>}
                  </td>
                  <td>
                    <span className="table-secondary">{customer.contactName || 'No contact name'}</span>
                    <span className="table-secondary">{customer.email || 'No email'}</span>
                    <span className="table-secondary">{customer.phone || 'No phone'}</span>
                  </td>
                  <td>
                    <span className="table-secondary">
                      {[customer.city, customer.state].filter(Boolean).join(', ') || 'No location'}
                    </span>
                    {customer.postalCode && <span className="table-secondary">{customer.postalCode}</span>}
                  </td>
                  <td>
                    <select
                      className="compact-select"
                      value={customer.status}
                      disabled={busyId === customer.id}
                      onChange={(event) => updateStatus(customer, event.target.value)}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </td>
                  <td>
                    <button className="secondary-button compact-button" type="button" onClick={() => openEdit(customer)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && customers.length === 0 && (
                <tr><td colSpan="5" className="empty-cell">No customers match this view.</td></tr>
              )}
              {loading && (
                <tr><td colSpan="5" className="empty-cell">Loading customers…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
