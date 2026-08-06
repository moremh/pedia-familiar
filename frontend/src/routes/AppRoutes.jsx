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

import LoginPage from '../pages/auth/LoginPage.jsx';
import RegisterPage from '../pages/auth/RegisterPage.jsx';
import InvitationPage from '../pages/auth/InvitationPage.jsx';

import FamilyDashboardPage from '../pages/family/FamilyDashboardPage.jsx';
import ChildrenPage from '../pages/family/ChildrenPage.jsx';
import ConsultationsPage from '../pages/family/ConsultationsPage.jsx';
import TreatmentsPage from '../pages/family/TreatmentsPage.jsx';
import RemindersPage from '../pages/family/RemindersPage.jsx';
import DocumentsPage from '../pages/family/DocumentsPage.jsx';
import VaccinesPage from '../pages/family/VaccinesPage.jsx';
import MedicineCabinetPage from '../pages/family/MedicineCabinetPage.jsx';
import CaregiversPage from '../pages/family/CaregiversPage.jsx';
import AlertsPage from '../pages/family/AlertsPage.jsx';
import SettingsPage from '../pages/family/SettingsPage.jsx';
import MedicationHistoryPage from '../pages/family/MedicationHistoryPage.jsx';
import SubscriptionExpiredPage from '../pages/family/SubscriptionExpiredPage.jsx';

import AdminDashboardPage from '../pages/admin/AdminDashboardPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';

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
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
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
              element={
                <Navigate
                  to="/dashboard/consultations"
                  replace
                />
              }
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
  );
}

export default AppRoutes;
