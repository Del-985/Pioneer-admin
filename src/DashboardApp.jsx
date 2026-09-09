import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { CompanySelector } from './components/CompanySelector.jsx';
import { useAuth } from './context/AuthContext.jsx';
import { useCompany } from './context/CompanyContext.jsx';
import { getRegisteredFeature } from './features/featureRegistry.jsx';
import { apiRequest } from './lib/api.js';

const platformNavItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/companies', label: 'Companies' },
  { to: '/users', label: 'Users' },
  { to: '/account', label: 'Account' },
  { to: '/system', label: 'System' },
];

export default function DashboardApp() {
  const { user, logout } = useAuth();
  const { selectedCompany, enabledFeatures } = useCompany();
  const [overview, setOverview] = useState(null);
  const [health, setHealth] = useState(null);
  const [readiness, setReadiness] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const workspaceName = selectedCompany?.name || 'Pioneer Legacy Works';
  const userLabel = user?.displayName || user?.email || 'Pioneer user';
  const userInitial = userLabel.trim().charAt(0).toUpperCase() || 'P';

  const companyNavItems = enabledFeatures
    .map((feature) => {
      const registeredFeature = getRegisteredFeature(feature.key);
      if (!registeredFeature) return null;
      return {
        key: feature.key,
        to: registeredFeature.path,
        label: feature.name || registeredFeature.label,
      };
    })
    .filter(Boolean);

  async function loadDashboard() {
    setRefreshing(true);
    setError('');

    const [overviewResult, healthResult, readinessResult] = await Promise.allSettled([
      apiRequest('/api/admin/overview'),
      apiRequest('/api/health'),
      apiRequest('/api/health/ready'),
    ]);

    if (overviewResult.status === 'fulfilled') {
      setOverview(overviewResult.value?.data || null);
    } else {
      setOverview(null);
      setError(overviewResult.reason instanceof Error ? overviewResult.reason.message : 'Unable to load the administration overview.');
    }

    setHealth(healthResult.status === 'fulfilled' ? healthResult.value : null);
    setReadiness(readinessResult.status === 'fulfilled' ? readinessResult.value : null);
    setRefreshing(false);
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

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
          <section className="page-panel dashboard-page">
            <div className="dashboard-header">
              <div className="dashboard-heading-copy">
                <p className="eyebrow">Administration overview</p>
                <h1>Dashboard</h1>
                <p className="page-description">Platform status, organization totals, and direct access to Pioneer administration tools.</p>
              </div>

              <aside className="dashboard-workspace" aria-label="Current workspace">
                <span>Current workspace</span>
                <strong>{workspaceName}</strong>
                <small>{selectedCompany ? 'Business administration context' : 'Platform-wide administration'}</small>
                <button className="text-button" type="button" onClick={loadDashboard} disabled={refreshing}>
                  {refreshing ? 'Refreshing…' : 'Refresh dashboard'}
                </button>
              </aside>
            </div>

            {error && <p className="form-error section-error">{error}</p>}

            <div className="metric-grid dashboard-metrics">
              <article className="metric-card">
                <span>Legal entities</span>
                <strong>{overview?.legalEntities?.active ?? 0}</strong>
                <small>{overview?.legalEntities?.total ?? 0} total</small>
              </article>
              <article className="metric-card">
                <span>Business units</span>
                <strong>{overview?.businessUnits?.active ?? 0}</strong>
                <small>{overview?.businessUnits?.total ?? 0} total</small>
              </article>
              <article className="metric-card">
                <span>Users</span>
                <strong>{overview?.users?.active ?? 0}</strong>
                <small>{overview?.users?.total ?? 0} total</small>
              </article>
              <article className="metric-card">
                <span>Sites</span>
                <strong>{overview?.sites ?? 0}</strong>
                <small>accessible</small>
              </article>
              <article className="metric-card">
                <span>Open contacts</span>
                <strong>{overview?.openContacts ?? 0}</strong>
                <small>new or in progress</small>
              </article>
            </div>

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
                  <div><dt>API</dt><dd>{health?.status || 'Checking'}</dd></div>
                  <div><dt>Database</dt><dd>{readiness?.database || 'Checking'}</dd></div>
                  <div><dt>Readiness</dt><dd>{readiness?.status || 'Checking'}</dd></div>
                </dl>
              </section>

              <section className="dashboard-detail-card">
                <div className="dashboard-detail-heading">
                  <div>
                    <span className="dashboard-section-label">Workspace</span>
                    <h2>Company context</h2>
                  </div>
                  <NavLink to="/companies">Manage companies</NavLink>
                </div>
                <dl className="dashboard-detail-list">
                  <div><dt>Workspace</dt><dd>{selectedCompany ? 'Business' : 'Platform'}</dd></div>
                  <div><dt>Enabled tools</dt><dd>{companyNavItems.length}</dd></div>
                  <div><dt>Open contacts</dt><dd>{overview?.openContacts ?? 0}</dd></div>
                </dl>
              </section>
            </div>

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
                {companyNavItems.map((item) => (
                  <NavLink key={item.key} to={item.to}><strong>{item.label}</strong><span>Open for {workspaceName}</span></NavLink>
                ))}
              </div>
            </section>
          </section>
        </div>
      </main>
    </div>
  );
}
