import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext.jsx';
import { apiRequest } from '../lib/api.js';

const statusOptions = [
  { value: '', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'spam', label: 'Spam' },
];

function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function isServiceRequest(contact) {
  return contact.subject?.toLowerCase().startsWith('service request:') ||
    contact.message?.startsWith('Pioneer Outdoor Services service request');
}

export function ContactsPage() {
  const { selectedCompany, features } = useCompany();
  const feature = features.find((item) => item.key === 'contacts');
  const [contacts, setContacts] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [expandedId, setExpandedId] = useState('');

  const endpoint = useMemo(() => {
    if (!selectedCompany) return '';
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (search) params.set('search', search);
    const query = params.toString();
    return `/api/admin/business-units/${selectedCompany.id}/contacts${query ? `?${query}` : ''}`;
  }, [selectedCompany, statusFilter, search]);

  const loadContacts = useCallback(async () => {
    if (!endpoint) return;
    setLoading(true);
    try {
      const payload = await apiRequest(endpoint);
      setContacts(Array.isArray(payload?.data) ? payload.data : []);
      setError('');
    } catch (loadError) {
      setContacts([]);
      setError(loadError instanceof Error ? loadError.message : 'Unable to load contacts.');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const serviceRequestCount = contacts.filter(isServiceRequest).length;
  const newRequestCount = contacts.filter((contact) => isServiceRequest(contact) && contact.status === 'new').length;

  if (!selectedCompany || !feature?.enabled) {
    return <Navigate to="/dashboard" replace />;
  }

  async function updateStatus(contactId, status) {
    setBusyId(contactId);
    try {
      const payload = await apiRequest(
        `/api/admin/business-units/${selectedCompany.id}/contacts/${contactId}/status`,
        { method: 'PATCH', body: JSON.stringify({ status }) },
      );
      setContacts((current) => current.map((contact) => (
        contact.id === contactId ? payload.data : contact
      )));
      setError('');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to update contact.');
    } finally {
      setBusyId('');
    }
  }

  async function convertToCustomer(contactId) {
    setBusyId(contactId);
    try {
      await apiRequest(
        `/api/admin/business-units/${selectedCompany.id}/contacts/${contactId}/convert-to-customer`,
        { method: 'POST' },
      );
      setExpandedId('');
      await loadContacts();
      setError('');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to create customer.');
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
          <h1>Contacts</h1>
          <p className="page-description">Inbound leads and service requests routed to this company.</p>
          <div className="lead-summary" aria-label="Lead summary">
            <span><strong>{newRequestCount}</strong> new service requests</span>
            <span><strong>{serviceRequestCount}</strong> service requests shown</span>
          </div>
        </div>
        <span className="record-count">{contacts.length} shown</span>
      </div>

      <div className="feature-toolbar">
        <form className="search-form" onSubmit={submitSearch}>
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search name, address, email, phone, subject…"
            aria-label="Search contacts"
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
            {statusOptions.map((option) => (
              <option key={option.value || 'all'} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="form-error section-error">{error}</p>}

      <div className="data-section">
        <div className="table-wrap">
          <table className="feature-table contacts-table">
            <thead>
              <tr>
                <th>Contact</th>
                <th>Subject / message</th>
                <th>Received</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => {
                const serviceRequest = isServiceRequest(contact);
                const expanded = expandedId === contact.id;
                return (
                  <Fragment key={contact.id}>
                    <tr className={serviceRequest ? 'service-request-row' : ''}>
                      <td>
                        <strong className="table-primary">{contact.name}</strong>
                        <span className="table-secondary">{contact.email || 'No email'}</span>
                        <span className="table-secondary">{contact.phone || 'No phone'}</span>
                      </td>
                      <td className="message-cell">
                        <div className="subject-line">
                          {serviceRequest && <span className="lead-badge">Service request</span>}
                          <strong className="table-primary">{contact.subject || 'Contact request'}</strong>
                        </div>
                        <span className="table-secondary message-preview">{contact.message}</span>
                      </td>
                      <td>{formatDate(contact.createdAt)}</td>
                      <td>
                        <select
                          className="compact-select"
                          value={contact.status}
                          disabled={busyId === contact.id}
                          onChange={(event) => updateStatus(contact.id, event.target.value)}
                          aria-label={`Status for ${contact.name}`}
                        >
                          {statusOptions.filter((option) => option.value).map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <div className="row-button-group">
                          <button
                            className="secondary-button compact-button"
                            type="button"
                            onClick={() => setExpandedId(expanded ? '' : contact.id)}
                            aria-expanded={expanded}
                          >
                            {expanded ? 'Hide details' : 'View details'}
                          </button>
                          <button
                            className="secondary-button compact-button"
                            type="button"
                            disabled={busyId === contact.id}
                            onClick={() => convertToCustomer(contact.id)}
                          >
                            {busyId === contact.id ? 'Working…' : 'Create customer'}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="contact-detail-row">
                        <td colSpan="5">
                          <div className="contact-detail-panel">
                            <div className="contact-detail-heading">
                              <div>
                                <span className="feature-category">{serviceRequest ? 'Service request' : 'Contact submission'}</span>
                                <h3>{contact.subject || 'Contact request'}</h3>
                              </div>
                              <span className="record-count">Received {formatDate(contact.createdAt)}</span>
                            </div>
                            <pre className="contact-message-full">{contact.message}</pre>
                            <div className="contact-meta-grid">
                              <div><span>Source</span><strong>{contact.sourcePath || '—'}</strong></div>
                              <div><span>Site</span><strong>{contact.siteKey || '—'}</strong></div>
                              <div><span>Email</span><strong>{contact.email || '—'}</strong></div>
                              <div><span>Phone</span><strong>{contact.phone || '—'}</strong></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!loading && contacts.length === 0 && (
                <tr><td colSpan="5" className="empty-cell">No contacts match this view.</td></tr>
              )}
              {loading && (
                <tr><td colSpan="5" className="empty-cell">Loading contacts…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
