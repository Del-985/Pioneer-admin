import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AuthRecoveryRoot from './AuthRecoveryRoot.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CompanyProvider } from './context/CompanyContext.jsx';
import './styles.css';
import './management.css';
import './features.css';
import './schedule.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CompanyProvider>
          <AuthRecoveryRoot />
        </CompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
