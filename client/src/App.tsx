import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './features/auth';
import { HouseholdPage } from './pages/HouseholdPage';
import { HomePage } from './pages/HomePage';
import { ImportPage } from './pages/ImportPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

const RequireAuth = ({ children }: { children: JSX.Element }): JSX.Element => {
  const location = useLocation();
  const { isAuthenticated, isInitializing } = useAuth();
  if (isInitializing) {
    return <div>Loading...</div>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
};

const PublicOnly = ({ children }: { children: JSX.Element }): JSX.Element => {
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | undefined)?.from?.pathname ?? '/';
  const { isAuthenticated, isInitializing } = useAuth();
  if (isInitializing) {
    return <div>Loading...</div>;
  }
  if (isAuthenticated) {
    return <Navigate to={from} replace />;
  }
  return children;
};

const App = (): JSX.Element => {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnly>
            <RegisterPage />
          </PublicOnly>
        }
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <HomePage />
          </RequireAuth>
        }
      />
      <Route
        path="/groups"
        element={
          <RequireAuth>
            <HouseholdPage />
          </RequireAuth>
        }
      />
      <Route
        path="/import"
        element={
          <RequireAuth>
            <ImportPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
