import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PageLoading } from './components/ui';
import { useAuth } from './features/auth';
import { ACCOUNT_SETTINGS_PATH, PERSONAL_FINANCES_PATH } from './routes';

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
const InvitationsPage = lazy(() =>
  import('./pages/InvitationsPage').then((module) => ({ default: module.InvitationsPage })),
);
const AccountSettingsPage = lazy(() =>
  import('./pages/AccountSettingsPage').then((module) => ({ default: module.AccountSettingsPage })),
);

const RequireAuth = ({ children }: { children: JSX.Element }): JSX.Element => {
  const location = useLocation();
  const { isAuthenticated, isInitializing } = useAuth();
  if (isInitializing) {
    return <PageLoading />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
};

const PublicOnly = ({ children }: { children: JSX.Element }): JSX.Element => {
  const { isAuthenticated, isInitializing } = useAuth();
  if (isInitializing) {
    return <PageLoading />;
  }
  if (isAuthenticated) {
    return <Navigate to={PERSONAL_FINANCES_PATH} replace />;
  }
  return children;
};

const App = (): JSX.Element => {
  return (
    <Suspense fallback={<PageLoading />}>
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
        <Route
          path="/invitations"
          element={
            <RequireAuth>
              <InvitationsPage />
            </RequireAuth>
          }
        />
        <Route
          path={ACCOUNT_SETTINGS_PATH}
          element={
            <RequireAuth>
              <AccountSettingsPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default App;
