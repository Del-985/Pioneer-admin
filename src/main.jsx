import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { CompanyProvider } from './context/CompanyContext.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <CompanyProvider>
        <App />
      </CompanyProvider>
    </BrowserRouter>
  </StrictMode>,
);
