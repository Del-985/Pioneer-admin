import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { CompanyFeaturesPanel } from './components/CompanyFeaturesPanel.jsx';
import { CompanySelector } from './components/CompanySelector.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { useCompany } from './context/CompanyContext.jsx';
import { featureRegistry, getRegisteredFeature } from './features/featureRegistry.jsx';
import { apiRequest } from './lib/api.js';

const platformNavItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/companies', label: 'Companies' },
  { to: '/users', label: 'Users' },
  { to: '/account', label: 'Account' },
  { to: '/system', label: 'System' },
];

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function LoadingScreen() {
  return (
    <div className="auth-screen">
      <div className="auth-card auth-card-compact">
        <div className="brand-block auth-brand">
          <span className="brand-mark">P</span>
          <div>
            <strong>Pioneer</strong>
            <span>Administration</span>
          </div>
        </div>
        <p className="auth-status">Checking your session…</p>
      </div>
    </div>
  );
}

function LoginPage() {
  const { login, error: connectionError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await login(email, password);
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="brand-block auth-brand">
          <span className="brand-mark">P</span>
          <div>
            <strong>Pioneer</strong>
            <span>Administration</span>
          </div>
        </div>

        <div className="auth-heading">
          <p className="eyebrow">Pioneer Legacy Works</p>
          <h1>Admin sign in</h1>
          <p>Use your Pioneer platform account to continue.</p>
        </div>

        <label className="field-label" htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />

        <label className="field-label" htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />

        {(error || connectionError) && <p className="form-error">{error || connectionError}</p>}

        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

function DashboardPage() {
  const { selectedCompany, enabledFeatures } = useCompany();
  const [data, setData] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [health, setHealth] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [error, setError] = useState('');
  const [sectionErrors, setSectionErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingContactId, setUpdatingContactId] = useState(null);

  async function loadDashboard({ refresh = false } = {}) {
    if (refresh) setRefreshing(true);
    else setLoading(true);

    const [overviewResult, contactsResult, auditResult, healthResult, readinessResult] = await Promise.allSettled([
      apiRequest('/api/admin/overview'),
      apiRequest('/api/admin/sites/pioneer-legacy-works/contacts?limit=20'),
      apiRequest('/api/admin/audit?limit=8'),
      apiRequest('/api/health'),
      apiRequest('/api/health/ready'),
    ]);

    const nextSectionErrors = {};

    if (overviewResult.status === 'fulfilled') {
      setData(overviewResult.value?.data || null);
      setError('');
    } else {
      setError(overviewResult.reason instanceof Error ? overviewResult.reason.message : 'Unable to load dashboard overview.');
    }

    if (contactsResult.status === 'fulfilled') {
      const rows = Array.isArray(contactsResult.value?.data) ? contactsResult.value.data : [];
      setContacts(rows.filter((contact) => contact.status === 'new' || contact.status === 'in_progress').slice(0, 8));
    } else {
      setContacts([]);
      nextSectionErrors.contacts = contactsResult.reason instanceof Error ? contactsResult.reason.message : 'Contact queue is unavailable.';
    }

    if (auditResult.status === 'fulfilled') {
      setAuditEvents(Array.isArray(auditResult.value?.data) ? auditResult.value.data : []);
    } else {
      setAuditEvents([]);
      nextSectionErrors.audit = auditResult.reason instanceof Error ? auditResult.reason.message : 'Audit history is unavailable.';
    }

    if (healthResult.status === 'fulfilled') {
      setHealth(healthResult.value);
    } else {
      setHealth(null);
      nextSectionErrors.health = healthResult.reason instanceof Error ? healthResult.reason.message : 'API health is unavailable.';
    }

    if (readinessResult.status === 'fulfilled') {
      setReadiness(readinessResult.value);
    } else {
      setReadiness(null);
      nextSectionErrors.readiness = readinessResult.reason instanceof Error ? readinessResult.reason.message : 'Database readiness is unavailable.';
    }

    setSectionErrors(nextSectionErrors);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function handleContactStatus(contactId, status) {
    setUpdatingContactId(contactId);
    setSectionErrors((current) => ({ ...current, contactAction: '' }));

    try {
      await apiRequest(`/api/admin/sites/pioneer-legacy-works/contacts/${contactId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await loadDashboard({ refresh: true });
    } catch (updateError) {
      setSectionErrors((current) => ({
        ...current,
        contactAction: updateError instanceof Error ? updateError.message : 'Unable to update the contact.',
      }));
    } finally {
      setUpdatingContactId(null);
    }
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
  }

  function formatAction(value) {
    if (!value) return 'Activity';
    return value
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (character) => character.toUpperCase());
  }

  const workspaceName = selectedCompany?.name || 'Pioneer Legacy Works';
  const companyTools = enabledFeatures
    .map((feature) => {
      const registeredFeature = getRegisteredFeature(feature.key);
      if (!registeredFeature) return null;
      return {
        key: feature.key,
        label: feature.name || registeredFeature.label,
        path: registeredFeature.path,
      };
    })
    .filter(Boolean);

  return (
    <section className="page-panel dashboard-page">
      <div className="dashboard-header">
        <div className="dashboard-heading-copy">
          <p className="eyebrow">Administration overview</p>
          <h1>Dashboard</h1>
          <p className="page-description">Live platform status, work requiring attention, recent administrative activity, and direct access to Pioneer tools.</p>
        </div>

        <aside className="dashboard-workspace" aria-label="Current workspace">
          <span>Current workspace</span>
          <strong>{workspaceName}</strong>
          <small>{selectedCompany ? 'Business administration context' : 'Platform-wide administration'}</small>
          <button className="text-button" type="button" onClick={() => loadDashboard({ refresh: true })} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh dashboard'}
          </button>
        </aside>
      </div>

      {error && <p className="form-error section-error">{error}</p>}

      {loading && !data ? (
        <p className="loading-copy">Loading dashboard…</p>
      ) : data ? (
        <div className="metric-grid dashboard-metrics">
          <article className="metric-card"><span>Legal entities</span><strong>{data.legalEntities?.active ?? 0}</strong><small>{data.legalEntities?.total ?? 0} total</small></article>
          <article className="metric-card"><span>Business units</span><strong>{data.businessUnits?.active ?? 0}</strong><small>{data.businessUnits?.total ?? 0} total</small></article>
          <article className="metric-card"><span>Users</span><strong>{data.users?.active ?? 0}</strong><small>{data.users?.total ?? 0} total</small></article>
          <article className="metric-card"><span>Sites</span><strong>{data.sites ?? 0}</strong><small>accessible</small></article>
          <article className="metric-card"><span>Open contacts</span><strong>{data.openContacts ?? 0}</strong><small>new or in progress</small></article>
        </div>
      ) : null}

      <div className="dashboard-detail-grid">
        <section className="dashboard-detail-card">
          <div className="dashboard-detail-heading">
            <div>
              <span className="dashboard-section-label">System</span>
              <h2>Operational status</h2>
            </div>
            <NavLink to="/system">Open system</NavLink>
          </div>
          <dl className="dashboard-detail-list">
            <div><dt>API</dt><dd>{health?.status || (sectionErrors.health ? 'Unavailable' : 'Checking')}</dd></div>
            <div><dt>Database</dt><dd>{readiness?.database || (sectionErrors.readiness ? 'Unavailable' : 'Checking')}</dd></div>
            <div><dt>Readiness</dt><dd>{readiness?.status || '—'}</dd></div>
          </dl>
        </section>

        <section className="dashboard-detail-card">
          <div className="dashboard-detail-heading">
            <div>
              <span className="dashboard-section-label">Workspace</span>
              <h2>Available tools</h2>
            </div>
            <NavLink to="/companies">Configure</NavLink>
          </div>
          <dl className="dashboard-detail-list">
            <div><dt>Context</dt><dd>{selectedCompany ? 'Business' : 'Platform'}</dd></div>
            <div><dt>Enabled business tools</dt><dd>{companyTools.length}</dd></div>
            <div><dt>Open contacts</dt><dd>{data?.openContacts ?? 0}</dd></div>
          </dl>
        </section>
      </div>

      <section className="dashboard-shortcuts" aria-labelledby="dashboard-contacts-title">
        <div className="dashboard-detail-heading">
          <div>
            <span className="dashboard-section-label">Work queue</span>
            <h2 id="dashboard-contacts-title">Open contact submissions</h2>
          </div>
          <span className="status-pill active">{contacts.length} shown</span>
        </div>

        {sectionErrors.contacts ? (
          <p className="form-error section-error">{sectionErrors.contacts}</p>
        ) : contacts.length > 0 ? (
          <div className="table-wrap data-section">
            <table>
              <thead>
                <tr><th>Contact</th><th>Subject</th><th>Business</th><th>Status</th><th>Received</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {contacts.map((contact) => (
                  <tr key={contact.id}>
                    <td>{contact.name || contact.email || 'Unknown'}</td>
                    <td>{contact.subject || 'General inquiry'}</td>
                    <td>{contact.businessUnit?.name || 'Parent site'}</td>
                    <td><span className={`status-pill ${contact.status === 'in_progress' ? 'active' : ''}`}>{contact.status.replace('_', ' ')}</span></td>
                    <td>{formatDate(contact.createdAt)}</td>
                    <td>
                      {contact.status === 'new' && (
                        <button className="text-button" type="button" disabled={updatingContactId === contact.id} onClick={() => handleContactStatus(contact.id, 'in_progress')}>In progress</button>
                      )}
                      {' '}
                      <button className="text-button" type="button" disabled={updatingContactId === contact.id} onClick={() => handleContactStatus(contact.id, 'resolved')}>Resolve</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="loading-copy">No unresolved parent-site contacts are waiting for action.</p>
        )}
        {sectionErrors.contactAction && <p className="form-error section-error">{sectionErrors.contactAction}</p>}
      </section>

      <section className="dashboard-shortcuts" aria-labelledby="dashboard-activity-title">
        <div className="dashboard-detail-heading">
          <div>
            <span className="dashboard-section-label">Audit</span>
            <h2 id="dashboard-activity-title">Recent administrative activity</h2>
          </div>
          <span className="status-pill">Latest {auditEvents.length}</span>
        </div>

        {sectionErrors.audit ? (
          <p className="form-error section-error">{sectionErrors.audit}</p>
        ) : auditEvents.length > 0 ? (
          <div className="table-wrap data-section">
            <table>
              <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Resource</th></tr></thead>
              <tbody>
                {auditEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDate(event.createdAt)}</td>
                    <td>{event.actor?.name || 'System'}</td>
                    <td>{formatAction(event.action)}</td>
                    <td>{formatAction(event.resourceType)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="loading-copy">No audit events are visible in your current scope.</p>
        )}
      </section>

      <section className="dashboard-shortcuts" aria-labelledby="dashboard-shortcuts-title">
        <div>
          <span className="dashboard-section-label">Shortcuts</span>
          <h2 id="dashboard-shortcuts-title">Administration tools</h2>
        </div>
        <div className="dashboard-shortcut-grid">
          <NavLink to="/companies"><strong>Companies</strong><span>Entities, business units, and company features</span></NavLink>
          <NavLink to="/users"><strong>Users</strong><span>Review platform identities and access</span></NavLink>
          <NavLink to="/system"><strong>System</strong><span>Check backend and database readiness</span></NavLink>
          <a href="https://books.pioneerlegacyworks.com"><strong>Bookkeeping</strong><span>Open Pioneer Bookkeeping</span></a>
          {companyTools.map((tool) => (
            <NavLink key={tool.key} to={tool.path}><strong>{tool.label}</strong><span>Open for {workspaceName}</span></NavLink>
          ))}
        </div>
      </section>
    </section>
  );
}

function CompaniesPage() {
  const { refreshCompanies, selectCompany } = useCompany();
  const [legalEntities, setLegalEntities] = useState([]);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submittingEntity, setSubmittingEntity] = useState(false);
  const [submittingUnit, setSubmittingUnit] = useState(false);
  const [entityForm, setEntityForm] = useState({ legalName: '', displayName: '', slug: '' });
  const [unitForm, setUnitForm] = useState({ legalEntityId: '', name: '', slug: '' });

  async function loadCompanies() {
    const [entitiesPayload, unitsPayload] = await Promise.all([
      apiRequest('/api/admin/legal-entities'),
      apiRequest('/api/admin/business-units?includeInactive=true'),
    ]);
    const nextEntities = Array.isArray(entitiesPayload?.data) ? entitiesPayload.data : [];
    const nextUnits = Array.isArray(unitsPayload?.data) ? unitsPayload.data : [];
    setLegalEntities(nextEntities);
    setBusinessUnits(nextUnits);
    setUnitForm((current) => ({
      ...current,
      legalEntityId: current.legalEntityId || nextEntities[0]?.id || '',
    }));
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiRequest('/api/admin/legal-entities'),
      apiRequest('/api/admin/business-units?includeInactive=true'),
    ])
      .then(([entitiesPayload, unitsPayload]) => {
        if (cancelled) return;
        const nextEntities = Array.isArray(entitiesPayload?.data) ? entitiesPayload.data : [];
        const nextUnits = Array.isArray(unitsPayload?.data) ? unitsPayload.data : [];
        setLegalEntities(nextEntities);
        setBusinessUnits(nextUnits);
        setUnitForm((current) => ({ ...current, legalEntityId: current.legalEntityId || nextEntities[0]?.id || '' }));
        setError('');
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load companies.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreateLegalEntity(event) {
    event.preventDefault();
    setSubmittingEntity(true);
    setError('');
    setSuccess('');
    try {
      await apiRequest('/api/admin/legal-entities', {
        method: 'POST',
        body: JSON.stringify({ ...entityForm, status: 'active' }),
      });
      setEntityForm({ legalName: '', displayName: '', slug: '' });
      await loadCompanies();
      setSuccess('Legal entity created. You can now create a business unit under it.');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create legal entity.');
    } finally {
      setSubmittingEntity(false);
    }
  }

  async function handleCreateBusinessUnit(event) {
    event.preventDefault();
    setSubmittingUnit(true);
    setError('');
    setSuccess('');
    try {
      const payload = await apiRequest('/api/admin/business-units', {
        method: 'POST',
        body: JSON.stringify({ ...unitForm, status: 'active' }),
      });
      const createdUnit = payload?.data;
      setUnitForm((current) => ({ legalEntityId: current.legalEntityId, name: '', slug: '' }));
      await loadCompanies();
      refreshCompanies();
      if (createdUnit?.id) selectCompany(createdUnit.id);
      setSuccess('Business unit created. Pioneer Bookkeeping can now open books for this company.');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create business unit.');
    } finally {
      setSubmittingUnit(false);
    }
  }

  return (
    <section className="page-panel">
      <p className="eyebrow">Organization</p>
      <h1>Companies</h1>
      <p className="page-description">Create legal entities and operating business units, then configure the modules enabled for each company.</p>

      {error && <p className="form-error section-error">{error}</p>}
      {success && <p className="form-success section-error">{success}</p>}

      <div className="management-grid">
        <form className="management-card" onSubmit={handleCreateLegalEntity}>
          <div>
            <p className="eyebrow">Step 1</p>
            <h2>Create legal entity</h2>
            <p>Use the actual legal/tax entity name here.</p>
          </div>
          <label className="field-label" htmlFor="legal-name">Legal name</label>
          <input id="legal-name" value={entityForm.legalName} onChange={(event) => setEntityForm((current) => ({ ...current, legalName: event.target.value }))} required />
          <label className="field-label" htmlFor="display-name">Display name</label>
          <input id="display-name" value={entityForm.displayName} onChange={(event) => {
            const value = event.target.value;
            setEntityForm((current) => ({ ...current, displayName: value, slug: current.slug || slugify(value) }));
          }} required />
          <label className="field-label" htmlFor="entity-slug">Slug</label>
          <input id="entity-slug" value={entityForm.slug} onChange={(event) => setEntityForm((current) => ({ ...current, slug: slugify(event.target.value) }))} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
          <button className="primary-button" type="submit" disabled={submittingEntity}>{submittingEntity ? 'Creating…' : 'Create legal entity'}</button>
        </form>

        <form className="management-card" onSubmit={handleCreateBusinessUnit}>
          <div>
            <p className="eyebrow">Step 2</p>
            <h2>Create business unit</h2>
            <p>Business units are the operating companies/divisions whose books you work in.</p>
          </div>
          <label className="field-label" htmlFor="unit-entity">Legal entity</label>
          <select id="unit-entity" value={unitForm.legalEntityId} onChange={(event) => setUnitForm((current) => ({ ...current, legalEntityId: event.target.value }))} required disabled={legalEntities.length === 0}>
            <option value="">Select legal entity</option>
            {legalEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.displayName}</option>)}
          </select>
          <label className="field-label" htmlFor="unit-name">Business unit name</label>
          <input id="unit-name" value={unitForm.name} onChange={(event) => {
            const value = event.target.value;
            setUnitForm((current) => ({ ...current, name: value, slug: current.slug || slugify(value) }));
          }} required disabled={legalEntities.length === 0} />
          <label className="field-label" htmlFor="unit-slug">Slug</label>
          <input id="unit-slug" value={unitForm.slug} onChange={(event) => setUnitForm((current) => ({ ...current, slug: slugify(event.target.value) }))} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required disabled={legalEntities.length === 0} />
          <button className="primary-button" type="submit" disabled={submittingUnit || legalEntities.length === 0}>{submittingUnit ? 'Creating…' : 'Create business unit'}</button>
          {legalEntities.length === 0 && <small>Create a legal entity first.</small>}
        </form>
      </div>

      <div className="data-section">
        <h2>Legal entities</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Legal name</th><th>Status</th></tr></thead>
            <tbody>
              {legalEntities.map((entity) => <tr key={entity.id}><td>{entity.displayName}</td><td>{entity.legalName}</td><td><span className={`status-pill ${entity.status}`}>{entity.status}</span></td></tr>)}
              {!error && legalEntities.length === 0 && <tr><td colSpan="3" className="empty-cell">No legal entities configured yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="data-section">
        <div className="section-heading-row">
          <h2>Business units</h2>
          {businessUnits.length > 0 && <a className="secondary-link" href="https://books.pioneerlegacyworks.com">Open Pioneer Bookkeeping</a>}
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Legal entity</th><th>Status</th></tr></thead>
            <tbody>
              {businessUnits.map((unit) => <tr key={unit.id}><td>{unit.name}</td><td>{unit.legalEntity?.name || '—'}</td><td><span className={`status-pill ${unit.status}`}>{unit.status}</span></td></tr>)}
              {!error && businessUnits.length === 0 && <tr><td colSpan="3" className="empty-cell">No business units configured yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <CompanyFeaturesPanel />
    </section>
  );
}

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiRequest('/api/admin/users')
      .then((payload) => {
        if (cancelled) return;
        setUsers(Array.isArray(payload?.data) ? payload.data : []);
        setError('');
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load users.');
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="page-panel">
      <p className="eyebrow">Access</p>
      <h1>Users</h1>
      <p className="page-description">Pioneer platform identities visible within your administrative scope.</p>
      {error && <p className="form-error section-error">{error}</p>}
      <div className="data-section"><div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Status</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td>{user.displayName}</td><td>{user.email}</td><td><span className={`status-pill ${user.status}`}>{user.status}</span></td></tr>)}{!error && users.length === 0 && <tr><td colSpan="3" className="empty-cell">No users available.</td></tr>}</tbody></table></div></div>
    </section>
  );
}

function AccountPage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handlePasswordChange(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    if (newPassword.length < 12) {
      setError('New password must be at least 12 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest('/api/auth/password/change', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess('Password changed successfully. Other sessions have been invalidated according to the platform security policy.');
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'Unable to change password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page-panel">
      <p className="eyebrow">Account</p>
      <h1>Account settings</h1>
      <p className="page-description">Manage the credentials for your Pioneer platform identity.</p>

      <div className="account-summary">
        <strong>{user?.displayName || 'Pioneer user'}</strong>
        <span>{user?.email}</span>
      </div>

      <form className="management-card account-form" onSubmit={handlePasswordChange}>
        <h2>Change password</h2>
        <label className="field-label" htmlFor="current-password">Current password</label>
        <input id="current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required />
        <label className="field-label" htmlFor="new-password">New password</label>
        <input id="new-password" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength="12" required />
        <label className="field-label" htmlFor="confirm-password">Confirm new password</label>
        <input id="confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength="12" required />
        {error && <p className="form-error">{error}</p>}
        {success && <p className="form-success">{success}</p>}
        <button className="primary-button" type="submit" disabled={submitting}>{submitting ? 'Changing password…' : 'Change password'}</button>
      </form>
    </section>
  );
}

function SystemPage() {
  const [health, setHealth] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([apiRequest('/api/health'), apiRequest('/api/health/ready')])
      .then(([healthPayload, readinessPayload]) => {
        if (cancelled) return;
        setHealth(healthPayload);
        setReadiness(readinessPayload);
        setError('');
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to reach the backend.');
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="page-panel">
      <p className="eyebrow">Platform</p>
      <h1>System</h1>
      <p className="page-description">Shared Pioneer backend health and database readiness.</p>
      {error ? <p className="form-error section-error">{error}</p> : <div className="metric-grid system-grid"><article className="metric-card"><span>API</span><strong>{health?.status || '…'}</strong><small>{health?.service || 'Checking service'}</small></article><article className="metric-card"><span>Database</span><strong>{readiness?.database || '…'}</strong><small>{readiness?.status || 'Checking readiness'}</small></article></div>}
    </section>
  );
}

function AdminShell() {
  const { user, logout } = useAuth();
  const { selectedCompany, enabledFeatures } = useCompany();
  const companyNavItems = enabledFeatures
    .map((feature) => {
      const registeredFeature = getRegisteredFeature(feature.key);
      if (!registeredFeature) return null;
      return { to: registeredFeature.path, label: feature.name || registeredFeature.label, key: feature.key };
    })
    .filter(Boolean);

  const userLabel = user?.displayName || user?.email || 'Pioneer user';
  const userInitial = userLabel.trim().charAt(0).toUpperCase();
  const workspaceName = selectedCompany?.name || 'Pioneer Legacy Works';

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <NavLink className="brand-block sidebar-brand" to="/dashboard" aria-label="Pioneer Administration dashboard">
            <span className="brand-mark">P</span>
            <span className="brand-copy">
              <strong>Pioneer</strong>
              <span>Administration</span>
            </span>
          </NavLink>
          <span className="environment-badge">Internal system</span>
        </div>

        <div className="sidebar-context">
          <span className="sidebar-context-label">Current workspace</span>
          <strong title={workspaceName}>{workspaceName}</strong>
          <small>{selectedCompany ? 'Business administration' : 'Platform administration'}</small>
        </div>

        <nav className="sidebar-nav" aria-label="Admin navigation">
          <div className="nav-group">
            <span className="nav-section-label">Platform</span>
            {platformNavItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                {item.label}
              </NavLink>
            ))}
          </div>

          {selectedCompany && companyNavItems.length > 0 && (
            <div className="nav-group">
              <span className="nav-section-label">Business tools</span>
              {companyNavItems.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.to}
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          )}
        </nav>

        <div className="sidebar-footer">
          <span>Administration portal</span>
          <strong>admin.pioneerlegacyworks.com</strong>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-heading">
            <span className="topbar-kicker">Pioneer Legacy Works</span>
            <div className="topbar-title-row">
              <h2>Administration</h2>
              <span className="workspace-pill" title={workspaceName}>{workspaceName}</span>
            </div>
          </div>

          <div className="topbar-actions">
            <CompanySelector />

            <div className="user-menu">
              <div className="user-identity">
                <span className="user-avatar" aria-hidden="true">{userInitial}</span>
                <span className="user-copy">
                  <strong>{userLabel}</strong>
                  <small>{user?.email || 'Pioneer platform account'}</small>
                </span>
              </div>

              <div className="user-menu-actions">
                <NavLink className="text-link" to="/account">Account</NavLink>
                <button className="text-button" type="button" onClick={logout}>Sign out</button>
              </div>
            </div>
          </div>
        </header>

        <div className="page-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/companies" element={<CompaniesPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/system" element={<SystemPage />} />
            {Object.entries(featureRegistry).map(([featureKey, definition]) => <Route key={featureKey} path={definition.path} element={definition.element} />)}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  const { status } = useAuth();
  if (status === 'checking') return <LoadingScreen />;
  if (status !== 'authenticated') return <LoginPage />;
  return <AdminShell />;
}

export default App;
