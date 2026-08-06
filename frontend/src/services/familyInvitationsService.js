import {
  requireSupabase,
} from '../lib/supabaseClient.js';

import {
  loadCurrentAccountCache,
} from './supabaseSyncService.js';

import {
  refreshCaregiversFromSupabase,
} from './caregiversService.js';

const INVITATION_DURATION_DAYS = 7;

const PUBLIC_APP_URL = String(
  import.meta.env.VITE_APP_URL || '',
)
  .trim()
  .replace(/\/+$/, '');

function getInvitationUrl(path = '') {
  const invitationPath = String(
    path || '',
  ).trim();

  if (!invitationPath) {
    return '';
  }

  const currentOrigin =
    typeof window !== 'undefined'
      ? window.location.origin
      : '';

  const baseUrl =
    PUBLIC_APP_URL ||
    currentOrigin;

  if (!baseUrl) {
    return '';
  }

  try {
    const parsedUrl = new URL(
      invitationPath,
      baseUrl,
    );

    return `${baseUrl}${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
  } catch {
    const normalizedPath =
      invitationPath.startsWith('/')
        ? invitationPath
        : `/${invitationPath}`;

    return `${baseUrl}${normalizedPath}`;
  }
}

function normalizePreview(data) {
  if (!data || data.valid === false) {
    return {
      invitation: data
        ? {
            status:
              data.status ||
              data.reason ||
              'not_found',
          }
        : null,
      family: null,
      hasExistingAccount: false,
    };
  }

  return {
    invitation: {
      token: '',
      familyId: data.familyId,
      familyName: data.familyName,
      caregiverName:
        data.caregiverName,
      relationship:
        data.relationship ||
        'other',
      accessLevel:
        data.accessLevel ||
        'full_access',
      email: data.email,
      status:
        data.status || 'pending',
      expiresAt: data.expiresAt,
    },
    family: {
      id: data.familyId,
      familyName: data.familyName,
    },
    hasExistingAccount: false,
  };
}

function translateAuthError(error) {
  const message = String(
    error?.message || '',
  ).toLowerCase();

  if (
    message.includes(
      'invalid login credentials',
    )
  ) {
    return 'La cuenta ya existe, pero la contraseña ingresada es incorrecta.';
  }

  if (
    message.includes(
      'email not confirmed',
    )
  ) {
    return 'Confirmá tu correo electrónico antes de aceptar la invitación.';
  }

  return (
    error?.message ||
    'No se pudo aceptar la invitación.'
  );
}

export async function getInvitationByToken(
  token,
) {
  const details =
    await getInvitationDetails(
      token,
    );

  return details.invitation;
}

export async function getCaregiverInvitation() {
  return null;
}

export async function getInvitationDetails(
  token,
) {
  if (!token) {
    return {
      invitation: null,
      family: null,
      hasExistingAccount: false,
    };
  }

  const client = requireSupabase();

  const { data, error } =
    await client.rpc(
      'get_invitation_preview',
      {
        p_token: token,
      },
    );

  if (error) {
    throw new Error(
      error.message ||
        'No se pudo cargar la invitación.',
    );
  }

  const details =
    normalizePreview(data);

  if (details.invitation) {
    details.invitation.token =
      token;
  }

  return details;
}

export async function ensureCaregiverSystemAccess(
  caregiver,
) {
  if (!caregiver?.id) {
    throw new Error(
      'No se encontró el responsable.',
    );
  }

  if (
    caregiver.role === 'owner'
  ) {
    return {
      status: 'active',
      invitation: null,
      url: '',
    };
  }

  if (
    !caregiver.hasSystemAccess
  ) {
    await revokeCaregiverSystemAccess(
      caregiver,
    );

    return {
      status: 'none',
      invitation: null,
      url: '',
    };
  }

  if (!caregiver.email?.trim()) {
    throw new Error(
      'Ingresá un correo para darle acceso al sistema.',
    );
  }

  if (
    caregiver.userId &&
    caregiver.invitationStatus ===
      'active'
  ) {
    return {
      status: 'active',
      invitation: null,
      url: '',
    };
  }

  const client = requireSupabase();

  const { data, error } =
    await client.rpc(
      'create_family_invitation',
      {
        p_caregiver_id:
          caregiver.id,
        p_expiration_days:
          INVITATION_DURATION_DAYS,
      },
    );

  if (error) {
    if (
      String(
        error.message || '',
      ).includes(
        'ya tiene acceso',
      )
    ) {
      await refreshCaregiversFromSupabase();

      return {
        status: 'active',
        invitation: null,
        url: '',
      };
    }

    throw new Error(
      error.message ||
        'No se pudo generar la invitación.',
    );
  }

  await refreshCaregiversFromSupabase();

  const invitation = {
    id: data.invitationId,
    token: data.token,
    email: data.email,
    status: 'pending',
    expiresAt: data.expiresAt,
    path: data.path,
  };

  return {
    status: 'pending',
    invitation,
    url: getInvitationUrl(
      data.path,
    ),
  };
}

export async function renewCaregiverInvitation(
  caregiver,
) {
  return ensureCaregiverSystemAccess({
    ...caregiver,
    hasSystemAccess: true,
  });
}

export async function revokeCaregiverSystemAccess(
  caregiver,
) {
  if (
    !caregiver?.id ||
    caregiver.role === 'owner'
  ) {
    return;
  }

  const client = requireSupabase();

  const { error } =
    await client.rpc(
      'revoke_caregiver_access',
      {
        p_caregiver_id:
          caregiver.id,
      },
    );

  if (error) {
    throw new Error(
      error.message ||
        'No se pudo quitar el acceso.',
    );
  }

  await refreshCaregiversFromSupabase();
}

export async function acceptFamilyInvitation({
  token,
  password,
  confirmPassword,
}) {
  const normalizedPassword =
    String(password || '');

  if (
    normalizedPassword.length < 8
  ) {
    throw new Error(
      'La contraseña debe tener al menos 8 caracteres.',
    );
  }

  if (
    normalizedPassword !==
    String(confirmPassword || '')
  ) {
    throw new Error(
      'Las contraseñas no coinciden.',
    );
  }

  const details =
    await getInvitationDetails(
      token,
    );

  if (
    !details.invitation ||
    details.invitation.status !==
      'pending'
  ) {
    throw new Error(
      'La invitación ya no está disponible.',
    );
  }

  const email =
    details.invitation.email;

  const client = requireSupabase();

  let authUser = null;
  let session = null;

  const signUpResult =
    await client.auth.signUp({
      email,
      password:
        normalizedPassword,
      options: {
        data: {
          full_name:
            details.invitation
              .caregiverName,
          invited_family_id:
            details.invitation
              .familyId,
        },
      },
    });

  const isExistingAccount =
    signUpResult.error ||
    signUpResult.data?.user
      ?.identities?.length === 0;

  if (isExistingAccount) {
    const signInResult =
      await client.auth.signInWithPassword({
        email,
        password:
          normalizedPassword,
      });

    if (
      signInResult.error ||
      !signInResult.data?.user
    ) {
      throw new Error(
        translateAuthError(
          signInResult.error ||
            signUpResult.error,
        ),
      );
    }

    authUser =
      signInResult.data.user;
    session =
      signInResult.data.session;
  } else {
    authUser =
      signUpResult.data.user;
    session =
      signUpResult.data.session;
  }

  if (!session || !authUser) {
    throw new Error(
      'La cuenta fue creada. Confirmá el correo y luego abrí nuevamente la invitación para terminar el acceso.',
    );
  }

  const { data, error } =
    await client.rpc(
      'accept_family_invitation',
      {
        p_token: token,
      },
    );

  if (error) {
    throw new Error(
      error.message ||
        'No se pudo aceptar la invitación.',
    );
  }

  const context =
    await loadCurrentAccountCache(
      authUser,
    );

  return {
    invitation: {
      ...details.invitation,
      status: 'accepted',
    },
    user: context.user,
    family: context.family,
    session: context.session,
    caregiverId:
      data?.caregiverId,
  };
}
