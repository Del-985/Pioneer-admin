import { Navigate, NavLink, Route, Routes } from 'react-router-dom';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/companies', label: 'Companies' },
  { to: '/users', label: 'Users' },
  { to: '/system', label: 'System' },
];

function PlaceholderPage({ title, description }) {
  return (
    <section className="page-panel">
      <p className="eyebrow">Pioneer Legacy Works</p>
      <h1>{title}</h1>
      <p className="page-description">{description}</p>
    </section>
  );
}

function App() {
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
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <span className="topbar-label">Admin Portal</span>
            <span className="topbar-subtitle">Pioneer Legacy Works</span>
          </div>
          <div className="status-pill">Backend connection pending</div>
        </header>

        <div className="page-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <PlaceholderPage
                  title="Dashboard"
                  description="This will become the central operational view for Pioneer Legacy Works and its companies."
                />
              }
            />
            <Route
              path="/companies"
              element={
                <PlaceholderPage
                  title="Companies"
                  description="Company and business-unit administration will live here."
                />
              }
            />
            <Route
              path="/users"
              element={
                <PlaceholderPage
                  title="Users"
                  description="User accounts, roles, and permissions will be managed here."
                />
              }
            />
            <Route
              path="/system"
              element={
                <PlaceholderPage
                  title="System"
                  description="Shared backend status, configuration, and administrative controls will live here."
                />
              }
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
