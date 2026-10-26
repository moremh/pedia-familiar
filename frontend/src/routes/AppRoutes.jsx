import {
  lazy,
  Suspense,
} from 'react';

import {
  Navigate,
  Route,
  Routes,
} from 'react-router-dom';

import {
  AdminProtectedRoute,
  FamilyProtectedRoute,
  FullFamilyAccessRoute,
} from '../components/auth/AuthRouteGuards.jsx';

import FamilyLayout from '../components/layout/FamilyLayout.jsx';

import {
  getCurrentSession,
} from '../services/authService.js';

import {
  getFamilyHomePath,
} from '../services/familyAccessService.js';

const LoginPage = lazy(() =>
  import('../pages/auth/LoginPage.jsx')
);
const RegisterPage = lazy(() =>
  import('../pages/auth/RegisterPage.jsx')
);
const InvitationPage = lazy(() =>
  import('../pages/auth/InvitationPage.jsx')
);
const ForgotPasswordPage = lazy(() =>
  import('../pages/auth/ForgotPasswordPage.jsx')
);
const ResetPasswordPage = lazy(() =>
  import('../pages/auth/ResetPasswordPage.jsx')
);

const FamilyDashboardPage = lazy(() =>
  import('../pages/family/FamilyDashboardPage.jsx')
);
const ChildrenPage = lazy(() =>
  import('../pages/family/ChildrenPage.jsx')
);
const ConsultationsPage = lazy(() =>
  import('../pages/family/ConsultationsPage.jsx')
);
const AppointmentsPage = lazy(() =>
  import('../pages/family/AppointmentsPage.jsx')
);
const TreatmentsPage = lazy(() =>
  import('../pages/family/TreatmentsPage.jsx')
);
const RemindersPage = lazy(() =>
  import('../pages/family/RemindersPage.jsx')
);
const DocumentsPage = lazy(() =>
  import('../pages/family/DocumentsPage.jsx')
);
const VaccinesPage = lazy(() =>
  import('../pages/family/VaccinesPage.jsx')
);
const MedicineCabinetPage = lazy(() =>
  import('../pages/family/MedicineCabinetPage.jsx')
);
const CaregiversPage = lazy(() =>
  import('../pages/family/CaregiversPage.jsx')
);
const AlertsPage = lazy(() =>
  import('../pages/family/AlertsPage.jsx')
);
const SettingsPage = lazy(() =>
  import('../pages/family/SettingsPage.jsx')
);
const MedicationHistoryPage = lazy(() =>
  import('../pages/family/MedicationHistoryPage.jsx')
);
const HelpPage = lazy(() =>
  import('../pages/family/HelpPage.jsx')
);
const SubscriptionExpiredPage = lazy(() =>
  import('../pages/family/SubscriptionExpiredPage.jsx')
);

const AdminDashboardPage = lazy(() =>
  import('../pages/admin/AdminDashboardPage.jsx')
);
const NotFoundPage = lazy(() =>
  import('../pages/NotFoundPage.jsx')
);

function RouteLoading() {
  return (
    <div
      className="d-flex min-vh-100 align-items-center justify-content-center"
      role="status"
      aria-live="polite"
    >
      <span
        className="spinner-border text-primary"
        aria-hidden="true"
      />
      <span className="visually-hidden">
        Cargando sección...
      </span>
    </div>
  );
}

function HomeRedirect() {
  const session = getCurrentSession();

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (session.role === 'admin') {
    return (
      <Navigate
        to="/admin/dashboard"
        replace
      />
    );
  }

  return (
    <Navigate
      to={getFamilyHomePath()}
      replace
    />
  );
}

function DashboardIndexRedirect() {
  const destination = getFamilyHomePath();

  if (destination !== '/dashboard') {
    return (
      <Navigate
        to={destination}
        replace
      />
    );
  }

  return <FamilyDashboardPage />;
}

function AppRoutes() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/invite/:token" element={<InvitationPage />} />

      <Route element={<FamilyProtectedRoute />}>
        <Route
          path="/subscription"
          element={<SubscriptionExpiredPage />}
        />

        <Route
          path="/dashboard"
          element={<FamilyLayout />}
        >
          <Route
            index
            element={<DashboardIndexRedirect />}
          />

          <Route
            path="reminders"
            element={<RemindersPage />}
          />

          <Route
            path="history"
            element={<MedicationHistoryPage />}
          />

          <Route
            path="help"
            element={<HelpPage />}
          />

          <Route element={<FullFamilyAccessRoute />}>
            <Route
              path="children"
              element={<ChildrenPage />}
            />

            <Route
              path="consultations"
              element={<ConsultationsPage />}
            />

            <Route
              path="treatments"
              element={<TreatmentsPage />}
            />

            <Route
              path="documents"
              element={<DocumentsPage />}
            />

            <Route
              path="vaccines"
              element={<VaccinesPage />}
            />

            <Route
              path="medicine-cabinet"
              element={<MedicineCabinetPage />}
            />

            <Route
              path="caregivers"
              element={<CaregiversPage />}
            />

            <Route
              path="alerts"
              element={<AlertsPage />}
            />

            <Route
              path="settings"
              element={<SettingsPage />}
            />

            <Route
              path="appointments"
              element={<AppointmentsPage />}
            />

            <Route
              path="growth"
              element={
                <Navigate
                  to="/dashboard/children"
                  replace
                />
              }
            />

            <Route
              path="family-members"
              element={
                <Navigate
                  to="/dashboard/caregivers"
                  replace
                />
              }
            />

            <Route
              path="subscription"
              element={
                <Navigate
                  to="/subscription"
                  replace
                />
              }
            />
          </Route>

          <Route
            path="*"
            element={
              <Navigate
                to={getFamilyHomePath()}
                replace
              />
            }
          />
        </Route>
      </Route>

      <Route element={<AdminProtectedRoute />}>
        <Route
          path="/admin"
          element={
            <Navigate
              to="/admin/dashboard"
              replace
            />
          }
        />

        <Route
          path="/admin/dashboard"
          element={<AdminDashboardPage />}
        />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}

export default AppRoutes;
