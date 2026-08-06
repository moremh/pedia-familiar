import {
  useEffect,
  useState,
} from 'react';

import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';

import {
  clearInvalidSession,
  validateCurrentSession,
} from '../../services/authService.js';

function useSessionValidation() {
  const [, setRevision] =
    useState(0);

  useEffect(() => {
    function refreshValidation() {
      setRevision(
        (currentRevision) =>
          currentRevision + 1,
      );
    }

    window.addEventListener(
      'focus',
      refreshValidation,
    );

    window.addEventListener(
      'storage',
      refreshValidation,
    );

    const intervalId =
      window.setInterval(
        refreshValidation,
        15000,
      );

    return () => {
      window.removeEventListener(
        'focus',
        refreshValidation,
      );

      window.removeEventListener(
        'storage',
        refreshValidation,
      );

      window.clearInterval(
        intervalId,
      );
    };
  }, []);

  return validateCurrentSession();
}

export function FamilyProtectedRoute() {
  const location =
    useLocation();

  const validation =
    useSessionValidation();

  useEffect(() => {
    if (
      !validation.valid &&
      validation.reason !==
        'missing-session'
    ) {
      clearInvalidSession();
    }
  }, [
    validation.valid,
    validation.reason,
  ]);

  if (!validation.valid) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from:
            location.pathname,
        }}
      />
    );
  }

  if (
    validation.session.role ===
    'admin'
  ) {
    return (
      <Navigate
        to="/admin/dashboard"
        replace
      />
    );
  }

  return <Outlet />;
}

export function AdminProtectedRoute() {
  const location =
    useLocation();

  const validation =
    useSessionValidation();

  useEffect(() => {
    if (
      !validation.valid &&
      validation.reason !==
        'missing-session'
    ) {
      clearInvalidSession();
    }
  }, [
    validation.valid,
    validation.reason,
  ]);

  if (!validation.valid) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from:
            location.pathname,
        }}
      />
    );
  }

  if (
    validation.session.role !==
    'admin'
  ) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return <Outlet />;
}
