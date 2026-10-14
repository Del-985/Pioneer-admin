import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AuthRecoveryRoot from './AuthRecoveryRoot.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CompanyProvider } from './context/CompanyContext.jsx';
import {SandboxGate,SandboxBanner} from './components/Sandbox.jsx';
import './styles.css';
import './management.css';
import './features.css';
import './schedule.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SandboxGate><AuthProvider><SandboxBanner />
        <CompanyProvider>
          <AuthRecoveryRoot />
        </CompanyProvider>
      </AuthProvider></SandboxGate>
    </BrowserRouter>
  </StrictMode>,
);
