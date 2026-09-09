import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import RootApp from './RootApp.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CompanyProvider } from './context/CompanyContext.jsx';
import './styles.css';
import './management.css';
import './features.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CompanyProvider>
          <RootApp />
        </CompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
