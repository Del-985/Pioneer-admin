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
  { to: '/system', label: 'System' },
];

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
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />

        <label className="field-label" htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        {(error || connectionError) && (
          <p className="form-error">{error || connectionError}</p>
        )}

        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}

function DashboardPage() {
  const { selectedCompany } = useCompany();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    apiRequest('/api/admin/overview')
      .then((payload) => {
        if (cancelled) return;
        setData(payload?.data || null);
        setError('');
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load dashboard.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="page-panel">
      <p className="eyebrow">{selectedCompany?.name || 'Pioneer Legacy Works'}</p>
      <h1>Dashboard</h1>
      <p className="page-description">Platform activity and administration summary.</p>

      {error ? (
        <p className="form-error section-error">{error}</p>
      ) : data ? (
        <div className="metric-grid">
          <article className="metric-card">
            <span>Legal entities</span>
            <strong>{data.legalEntities?.active ?? 0}</strong>
            <small>{data.legalEntities?.total ?? 0} total</small>
          </article>
          <article className="metric-card">
            <span>Business units</span>
            <strong>{data.businessUnits?.active ?? 0}</strong>
            <small>{data.businessUnits?.total ?? 0} total</small>
          </article>
          <article className="metric-card">
            <span>Users</span>
            <strong>{data.users?.active ?? 0}</strong>
            <small>{data.users?.total ?? 0} total</small>
          </article>
          <article className="metric-card">
            <span>Sites</span>
            <strong>{data.sites ?? 0}</strong>
            <small>accessible</small>
          </article>
          <article className="metric-card">
            <span>Open contacts</span>
            <strong>{data.openContacts ?? 0}</strong>
            <small>new or in progress</small>
          </article>
        </div>
      ) : (
        <p className="loading-copy">Loading dashboard…</p>
      )}
    </section>
  );
}

function CompaniesPage() {
  const [legalEntities, setLegalEntities] = useState([]);
  const [businessUnits, setBusinessUnits] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      apiRequest('/api/admin/legal-entities'),
      apiRequest('/api/admin/business-units?includeInactive=true'),
    ])
      .then(([entitiesPayload, unitsPayload]) => {
        if (cancelled) return;
        setLegalEntities(Array.isArray(entitiesPayload?.data) ? entitiesPayload.data : []);
        setBusinessUnits(Array.isArray(unitsPayload?.data) ? unitsPayload.data : []);
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

  return (
    <section className="page-panel">
      <p className="eyebrow">Organization</p>
      <h1>Companies</h1>
      <p className="page-description">Legal entities, business units, and the modules enabled for each company.</p>

      {error && <p className="form-error section-error">{error}</p>}

      <div className="data-section">
        <h2>Legal entities</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Legal name</th><th>Status</th></tr>
            </thead>
            <tbody>
              {legalEntities.map((entity) => (
                <tr key={entity.id}>
                  <td>{entity.displayName}</td>
                  <td>{entity.legalName}</td>
                  <td><span className={`status-pill ${entity.status}`}>{entity.status}</span></td>
                </tr>
              ))}
              {!error && legalEntities.length === 0 && (
                <tr><td colSpan="3" className="empty-cell">No legal entities available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="data-section">
        <h2>Business units</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Legal entity</th><th>Status</th></tr>
            </thead>
            <tbody>
              {businessUnits.map((unit) => (
                <tr key={unit.id}>
                  <td>{unit.name}</td>
                  <td>{unit.legalEntity?.name || '—'}</td>
                  <td><span className={`status-pill ${unit.status}`}>{unit.status}</span></td>
                </tr>
              ))}
              {!error && businessUnits.length === 0 && (
                <tr><td colSpan="3" className="empty-cell">No business units available.</td></tr>
              )}
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

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="page-panel">
      <p className="eyebrow">Access</p>
      <h1>Users</h1>
      <p className="page-description">Pioneer platform identities visible within your administrative scope.</p>

      {error && <p className="form-error section-error">{error}</p>}

      <div className="data-section">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Status</th></tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>{user.displayName}</td>
                  <td>{user.email}</td>
                  <td><span className={`status-pill ${user.status}`}>{user.status}</span></td>
                </tr>
              ))}
              {!error && users.length === 0 && (
                <tr><td colSpan="3" className="empty-cell">No users available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="page-panel">
      <p className="eyebrow">Platform</p>
      <h1>System</h1>
      <p className="page-description">Shared Pioneer backend health and database readiness.</p>

      {error ? (
        <p className="form-error section-error">{error}</p>
      ) : (
        <div className="metric-grid system-grid">
          <article className="metric-card">
            <span>API</span>
            <strong>{health?.status || '…'}</strong>
            <small>{health?.service || 'Checking service'}</small>
          </article>
          <article className="metric-card">
            <span>Database</span>
            <strong>{readiness?.database || '…'}</strong>
            <small>{readiness?.status || 'Checking readiness'}</small>
          </article>
        </div>
      )}
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
      return {
        to: registeredFeature.path,
        label: feature.name || registeredFeature.label,
        key: feature.key,
      };
    })
    .filter(Boolean);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-mark">P</span>
          <div>
            <strong>Pioneer</strong>
            <span>Administration</span>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Admin navigation">
          {platformNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}

          {selectedCompany && companyNavItems.length > 0 && (
            <>
              <span className="nav-section-label">{selectedCompany.name}</span>
              {companyNavItems.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.to}
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                >
                  {item.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="topbar-heading">
            <span className="topbar-label">Admin Portal</span>
            <span className="topbar-subtitle">Pioneer Legacy Works</span>
          </div>
          <div className="topbar-actions">
            <CompanySelector />
            <div className="user-menu">
              <span>{user?.displayName || user?.email}</span>
              <button className="text-button" type="button" onClick={logout}>Sign out</button>
            </div>
          </div>
        </header>

        <div className="page-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/companies" element={<CompaniesPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/system" element={<SystemPage />} />
            {Object.entries(featureRegistry).map(([featureKey, definition]) => (
              <Route key={featureKey} path={definition.path} element={definition.element} />
            ))}
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
