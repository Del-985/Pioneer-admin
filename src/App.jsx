import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { CompanySelector } from './components/CompanySelector.jsx';
import { useCompany } from './context/CompanyContext.jsx';

const navItems = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/companies', label: 'Companies' },
  { to: '/users', label: 'Users' },
  { to: '/system', label: 'System' },
];

function PlaceholderPage({ title, description }) {
  const { selectedCompany } = useCompany();

  return (
    <section className="page-panel">
      <p className="eyebrow">{selectedCompany?.name || 'Pioneer Legacy Works'}</p>
      <h1>{title}</h1>
      <p className="page-description">{description}</p>
      {!selectedCompany && (
        <p className="context-notice">Select a company above to establish the active business context.</p>
      )}
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
          <div className="topbar-heading">
            <span className="topbar-label">Admin Portal</span>
            <span className="topbar-subtitle">Pioneer Legacy Works</span>
          </div>
          <CompanySelector />
        </header>

        <div className="page-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <PlaceholderPage
                  title="Dashboard"
                  description="This will become the central operational view for the selected Pioneer company."
                />
              }
            />
            <Route
              path="/companies"
              element={
                <PlaceholderPage
                  title="Companies"
                  description="Company and business-unit administration will live here. The selector above controls the active company context used throughout the portal."
                />
              }
            />
            <Route
              path="/users"
              element={
                <PlaceholderPage
                  title="Users"
                  description="User accounts, roles, and permissions will be managed within the selected company context."
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
