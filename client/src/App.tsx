import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './features/auth';

const HouseholdPage = lazy(() =>
  import('./pages/HouseholdPage').then((module) => ({ default: module.HouseholdPage })),
);
const BudgetPage = lazy(() =>
  import('./pages/BudgetPage').then((module) => ({ default: module.BudgetPage })),
);
const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })));
const ImportPage = lazy(() =>
  import('./pages/ImportPage').then((module) => ({ default: module.ImportPage })),
);
const LoginPage = lazy(() => import('./pages/LoginPage').then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() =>
  import('./pages/RegisterPage').then((module) => ({ default: module.RegisterPage })),
);
const SettlementsPage = lazy(() =>
  import('./pages/SettlementsPage').then((module) => ({ default: module.SettlementsPage })),
);

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
    <Suspense fallback={<div>Loading...</div>}>
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
          path="/budget"
          element={
            <RequireAuth>
              <BudgetPage />
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
          path="/settlements"
          element={
            <RequireAuth>
              <SettlementsPage />
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
    </Suspense>
  );
};

export default App;
