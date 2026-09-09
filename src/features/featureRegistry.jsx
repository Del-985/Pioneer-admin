import { Navigate } from 'react-router-dom';
import { useCompany } from '../context/CompanyContext.jsx';
import { ContactsPage } from './ContactsPage.jsx';
import { CustomersPage } from './CustomersPage.jsx';
import { FormsPage } from './FormsPage.jsx';

function SharedFeaturePage({ featureKey }) {
  const { selectedCompany, features } = useCompany();
  const feature = features.find((item) => item.key === featureKey);

  if (!selectedCompany || !feature?.enabled) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <section className="page-panel">
      <p className="eyebrow">{selectedCompany.name}</p>
      <h1>{feature.name}</h1>
      <p className="page-description">
        {feature.description || `${feature.name} for the selected company.`}
      </p>
      <div className="feature-placeholder">
        <strong>Shared feature module</strong>
        <p>
          This route is enabled by the selected company&apos;s configuration. The feature implementation
          will be shared across companies while reading company-specific configuration from the backend.
        </p>
      </div>
    </section>
  );
}

export const featureRegistry = {
  contacts: {
    path: '/contacts',
    label: 'Contacts',
    element: <ContactsPage />,
  },
  customers: {
    path: '/customers',
    label: 'Customers',
    element: <CustomersPage />,
  },
  scheduling: {
    path: '/schedule',
    label: 'Schedule',
    element: <SharedFeaturePage featureKey="scheduling" />,
  },
  work_orders: {
    path: '/work-orders',
    label: 'Work Orders',
    element: <SharedFeaturePage featureKey="work_orders" />,
  },
  estimates: {
    path: '/estimates',
    label: 'Estimates',
    element: <SharedFeaturePage featureKey="estimates" />,
  },
  invoices: {
    path: '/invoices',
    label: 'Invoices',
    element: <SharedFeaturePage featureKey="invoices" />,
  },
  forms: {
    path: '/forms',
    label: 'Forms',
    element: <FormsPage />,
  },
};

export function getRegisteredFeature(featureKey) {
  return featureRegistry[featureKey] || null;
}
