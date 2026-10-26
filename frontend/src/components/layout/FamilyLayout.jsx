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
import InAppNotificationCenter from '../notifications/InAppNotificationCenter.jsx';

import {
  getCurrentFamilySubscription,
  getSubscriptionAccessState,
  refreshCurrentFamilyAccessState,
} from '../../services/subscriptionService.js';

import {
  refreshCurrentPushSubscription,
} from '../../services/pushNotificationsService.js';

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

  const refreshRemoteAccess =
    useCallback(async () => {
      if (
        typeof navigator !== 'undefined' &&
        navigator.onLine === false
      ) {
        return;
      }

      try {
        const updatedFamily =
          await refreshCurrentFamilyAccessState();

        if (updatedFamily) {
          setFamilySubscription(
            updatedFamily,
          );
        }
      } catch (error) {
        console.error(
          'No se pudo actualizar el estado de acceso de la familia.',
          error,
        );
      }
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
    if (!accessState.allowed) {
      return;
    }

    refreshCurrentPushSubscription();
  }, [accessState.allowed]);

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
    function handleFocus() {
      refreshSubscription();
      refreshRemoteAccess();
    }

    function handleOnline() {
      refreshRemoteAccess();
    }

    window.addEventListener(
      'focus',
      handleFocus,
    );

    window.addEventListener(
      'online',
      handleOnline,
    );

    window.addEventListener(
      'storage',
      refreshSubscription,
    );

    const intervalId =
      window.setInterval(
        refreshRemoteAccess,
        60000,
      );

    return () => {
      window.removeEventListener(
        'focus',
        handleFocus,
      );

      window.removeEventListener(
        'online',
        handleOnline,
      );

      window.removeEventListener(
        'storage',
        refreshSubscription,
      );

      window.clearInterval(
        intervalId,
      );
    };
  }, [
    refreshRemoteAccess,
    refreshSubscription,
  ]);

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
      <InAppNotificationCenter />
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