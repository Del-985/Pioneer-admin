import { useLocation } from 'react-router-dom';
import App from './App.jsx';
import DashboardApp from './DashboardApp.jsx';
import { useAuth } from './context/AuthContext.jsx';

export default function RootApp() {
  const { status } = useAuth();
  const location = useLocation();
  const normalizedPath = location.pathname.replace(/\/+$/, '') || '/';
  const isDashboardPath = normalizedPath === '/' || normalizedPath === '/dashboard';

  if (status === 'authenticated' && isDashboardPath) {
    return <DashboardApp />;
  }

  return <App />;
}
