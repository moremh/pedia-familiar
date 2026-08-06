import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';

import FamilyNavbar from './FamilyNavbar.jsx';
import FamilySidebar from './FamilySidebar.jsx';

import {
  getCurrentFamilySubscription,
  getSubscriptionAccessState,
} from '../../services/subscriptionService.js';

import '../../styles/family-layout.css';

function FamilyLayout() {
  const [sidebarOpen, setSidebarOpen] =
    useState(false);

  const [familySubscription, setFamilySubscription] =
    useState(() =>
      getCurrentFamilySubscription(),
    );

  const location = useLocation();

  const refreshSubscription =
    useCallback(() => {
      setFamilySubscription(
        getCurrentFamilySubscription(),
      );
    }, []);

  const accessState = useMemo(
    () =>
      getSubscriptionAccessState(
        familySubscription,
      ),
    [familySubscription],
  );

  useEffect(() => {
    setSidebarOpen(false);
    refreshSubscription();
  }, [
    location.pathname,
    refreshSubscription,
  ]);

  useEffect(() => {
    document.body.classList.toggle(
      'family-sidebar-open',
      sidebarOpen,
    );

    return () => {
      document.body.classList.remove(
        'family-sidebar-open',
      );
    };
  }, [sidebarOpen]);

  useEffect(() => {
    window.addEventListener(
      'focus',
      refreshSubscription,
    );

    window.addEventListener(
      'storage',
      refreshSubscription,
    );

    const intervalId =
      window.setInterval(
        refreshSubscription,
        30000,
      );

    return () => {
      window.removeEventListener(
        'focus',
        refreshSubscription,
      );

      window.removeEventListener(
        'storage',
        refreshSubscription,
      );

      window.clearInterval(
        intervalId,
      );
    };
  }, [refreshSubscription]);

  if (!accessState.allowed) {
    return (
      <Navigate
        to="/subscription"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  return (
    <div className="family-layout">
      <FamilySidebar
        isOpen={sidebarOpen}
        onClose={() =>
          setSidebarOpen(false)
        }
      />

      <button
        type="button"
        className={`family-sidebar-overlay ${
          sidebarOpen
            ? 'is-visible'
            : ''
        }`}
        onClick={() =>
          setSidebarOpen(false)
        }
        aria-label="Cerrar menú lateral"
      />

      <div className="family-layout__content">
        <FamilyNavbar
          onMenuClick={() =>
            setSidebarOpen(true)
          }
        />

        <main className="family-main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default FamilyLayout;