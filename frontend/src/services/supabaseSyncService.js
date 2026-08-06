import {
  requireSupabase,
  isSupabaseConfigured,
} from '../lib/supabaseClient.js';

const STORAGE_KEYS = {
  session: 'mipeque-auth-session',
  users: 'mipeque-auth-users',
  currentFamilyId: 'mipeque-current-family-id',
  adminFamilies: 'mipeque-admin-families',
  adminPayments: 'mipeque-admin-payments',
  settings: 'mipeque-settings',
  caregivers: 'mipeque-caregivers',
  activeCaregiver: 'mipeque-active-caregiver',
  children: 'mipeque-children',
  consultations: 'mipeque-consultations',
  treatments: 'mipeque-treatments',
  reminders: 'mipeque-reminder-records',
  vaccines: 'mipeque-vaccines',
  documents: 'mipeque-medical-documents',
  medicineCabinet: 'mipeque-medicine-cabinet',
  medicineUsage: 'mipeque-medicine-stock-usage',
};

const SYNCABLE_KEYS = new Set([
  STORAGE_KEYS.settings,
  STORAGE_KEYS.children,
  STORAGE_KEYS.consultations,
  STORAGE_KEYS.treatments,
  STORAGE_KEYS.reminders,
  STORAGE_KEYS.vaccines,
  STORAGE_KEYS.documents,
  STORAGE_KEYS.medicineCabinet,
]);

const SYNC_PRIORITY = [
  STORAGE_KEYS.settings,
  STORAGE_KEYS.children,
  STORAGE_KEYS.consultations,
  STORAGE_KEYS.treatments,
  STORAGE_KEYS.reminders,
  STORAGE_KEYS.vaccines,
  STORAGE_KEYS.documents,
  STORAGE_KEYS.medicineCabinet,
];

let suppressRemoteSync = 0;
let syncTimer = null;
const pendingSyncKeys = new Set();
const hydratedIdsByStorageKey = new Map();
const hydratedRowFingerprintsByStorageKey = new Map();
let initializationPromise = null;

function getRowFingerprint(row) {
  return JSON.stringify(row);
}

function setHydratedRows(
  storageKey,
  rows = [],
) {
  const ids = new Set();
  const fingerprints = new Map();

  rows.forEach((row) => {
    if (!row?.id) {
      return;
    }

    ids.add(row.id);
    fingerprints.set(
      row.id,
      getRowFingerprint(row),
    );
  });

  hydratedIdsByStorageKey.set(
    storageKey,
    ids,
  );
  hydratedRowFingerprintsByStorageKey.set(
    storageKey,
    fingerprints,
  );
}

function getChangedRows(
  storageKey,
  rows,
) {
  const fingerprints =
    hydratedRowFingerprintsByStorageKey.get(
      storageKey,
    );

  if (!fingerprints) {
    return rows;
  }

  return rows.filter(
    (row) =>
      fingerprints.get(row.id) !==
      getRowFingerprint(row),
  );
}

function getKnownDeletedIds(
  storageKey,
  localIds,
) {
  const hydratedIds =
    hydratedIdsByStorageKey.get(
      storageKey,
    );

  if (!hydratedIds) {
    return [];
  }

  const localIdSet =
    new Set(localIds);

  return [...hydratedIds].filter(
    (id) => !localIdSet.has(id),
  );
}


function nullable(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return value;
}

function numberOrNull(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function numberOrZero(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function readJson(key, fallback) {
  try {
    const rawValue = localStorage.getItem(key);

    if (!rawValue) {
      return fallback;
    }

    return JSON.parse(rawValue);
  } catch (error) {
    console.error(`No se pudo leer ${key}.`, error);
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function getCurrentFamilyId() {
  return localStorage.getItem(STORAGE_KEYS.currentFamilyId) || '';
}

function getCachedSession() {
  return readJson(STORAGE_KEYS.session, null);
}

function getAutomaticFamilyStatus(family) {
  if (!family) {
    return 'expired';
  }

  if (family.access_status === 'suspended') {
    return 'suspended';
  }

  const now = Date.now();

  if (family.access_status === 'trial') {
    const end = Date.parse(family.trial_ends_at || '');
    return Number.isFinite(end) && end > now ? 'trial' : 'expired';
  }

  if (family.access_status === 'active') {
    const end = Date.parse(family.current_period_end || '');
    return Number.isFinite(end) && end > now ? 'active' : 'expired';
  }

  return family.access_status || 'expired';
}

function mapFamilyRow(row, ownerProfile = null, primaryCaregiver = null) {
  return {
    id: row.id,
    familyName: row.family_name,
    ownerUserId: row.created_by,
    ownerName:
      ownerProfile?.full_name ||
      primaryCaregiver?.full_name ||
      '',
    ownerEmail:
      ownerProfile?.email ||
      primaryCaregiver?.email ||
      '',
    phone:
      ownerProfile?.phone ||
      primaryCaregiver?.phone ||
      '',
    status: getAutomaticFamilyStatus(row),
    plan: row.current_plan || 'none',
    requestedPlan: row.requested_plan || '',
    createdAt: row.created_at,
    trialStartedAt: row.trial_started_at || '',
    trialEndsAt: row.trial_ends_at || '',
    subscriptionStartedAt: row.current_period_start || '',
    subscriptionEndsAt: row.current_period_end || '',
    childrenCount: Number(row.children_count || 0),
    membersCount: Number(row.members_count || 0),
    updatedAt: row.updated_at,
  };
}

function mapProfileToUser(profile, member = null) {
  return {
    id: profile.id,
    familyId: member?.family_id || '',
    caregiverId: member?.caregiver_id || '',
    fullName: profile.full_name || '',
    email: profile.email || '',
    phone: profile.phone || '',
    role:
      profile.app_role === 'admin'
        ? 'admin'
        : member?.member_role || 'member',
    accessLevel:
      profile.app_role === 'admin' ||
      member?.member_role === 'owner'
        ? 'full_access'
        : member?.access_level || 'full_access',
    status: profile.status || 'active',
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

function mapCaregiverRow(row, memberByCaregiverId = new Map()) {
  const member = memberByCaregiverId.get(row.id);

  return {
    id: row.id,
    userId: row.user_id || '',
    fullName: row.full_name,
    relationship: row.relationship || 'other',
    phone: row.phone || '',
    email: row.email || '',
    isPrimary: Boolean(row.is_primary),
    isActive: Boolean(row.is_active),
    hasSystemAccess: Boolean(row.has_system_access),
    invitationStatus: row.invitation_status || 'none',
    invitedAt: row.invited_at || '',
    invitationAcceptedAt: row.invitation_accepted_at || '',
    role: member?.member_role || 'member',
    accessLevel:
      member?.member_role === 'owner'
        ? 'full_access'
        : row.system_access_level ||
          member?.access_level ||
          'full_access',
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSettingsRow(row, family) {
  return {
    familyName: family?.family_name || 'Mi familia',
    contactName: row?.contact_name || '',
    contactEmail: row?.contact_email || '',
    phone: row?.phone || '',
    defaultCaregiverId: row?.default_caregiver_id || '',
    reminderAdvanceMinutes: Number(row?.reminder_advance_minutes ?? 15),
    expirationWarningDays: Number(row?.expiration_warning_days ?? 30),
    vaccineWarningDays: Number(row?.vaccine_warning_days ?? 30),
    showOverdueAlerts: row?.show_overdue_alerts ?? true,
    showStockAlerts: row?.show_stock_alerts ?? true,
    showExpirationAlerts: row?.show_expiration_alerts ?? true,
    showVaccineAlerts: row?.show_vaccine_alerts ?? true,
    createdAt: row?.created_at || family?.created_at || new Date().toISOString(),
    updatedAt: row?.updated_at || family?.updated_at || new Date().toISOString(),
  };
}

function mapChildRow(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    birthDate: row.birth_date,
    bloodType: row.blood_type || '',
    weight: row.weight === null ? '' : Number(row.weight),
    height: row.height === null ? '' : Number(row.height),
    allergies: row.allergies || '',
    medicalHistory: row.medical_history || '',
    healthInsurance: row.health_insurance || '',
    memberNumber: row.member_number || '',
    pediatricianName: row.pediatrician_name || '',
    pediatricianPhone: row.pediatrician_phone || '',
    emergencyContactName: row.emergency_contact_name || '',
    emergencyContactPhone: row.emergency_contact_phone || '',
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapConsultationRow(row) {
  return {
    id: row.id,
    childId: row.child_id,
    consultationDate: row.consultation_date,
    consultationTime: row.consultation_time
      ? String(row.consultation_time).slice(0, 5)
      : '',
    consultationType: row.consultation_type || 'pediatric',
    reason: row.reason,
    symptoms: row.symptoms || '',
    diagnosis: row.diagnosis || '',
    professionalName: row.professional_name || '',
    specialty: row.specialty || '',
    medicalCenter: row.medical_center || '',
    weight: row.weight === null ? '' : Number(row.weight),
    temperature: row.temperature === null ? '' : Number(row.temperature),
    indications: row.indications || '',
    followUpDate: row.follow_up_date || '',
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeTime(value) {
  if (!value) {
    return '';
  }

  return String(value).slice(0, 5);
}

function mapTreatmentRow(row) {
  return {
    id: row.id,
    childId: row.child_id,
    consultationId: row.consultation_id || '',
    medicationName: row.medication_name,
    presentation: row.presentation || '',
    dosageInstruction: row.dosage_instruction,
    administrationRoute: row.administration_route || 'oral',
    startDate: row.start_date,
    durationDays: Number(row.duration_days),
    endDate: row.end_date,
    frequencyMode: row.frequency_mode || 'interval',
    intervalHours: row.interval_hours === null ? '' : Number(row.interval_hours),
    firstDoseTime: normalizeTime(row.first_dose_time),
    customTimes: Array.isArray(row.custom_times)
      ? row.custom_times.map(normalizeTime)
      : [],
    status: row.status || 'active',
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapReminderRow(row) {
  return {
    id: row.id,
    treatmentId: row.treatment_id,
    childId: row.child_id,
    status: row.status || 'pending',
    scheduledAt: row.scheduled_at,
    originalTime: normalizeTime(row.original_time),
    postponedUntil: row.postponed_until || null,
    completedAt: row.completed_at || null,
    responsibleId: row.responsible_caregiver_id || '',
    responsibleName: row.responsible_name || '',
    medicationName: row.medication_name || '',
    presentation: row.presentation || '',
    dosageInstruction: row.dosage_instruction || '',
    childName: row.child_name || '',
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function createSignedFile(client, path, metadata) {
  if (!path) {
    return null;
  }

  const { data, error } = await client.storage
    .from('medical-files')
    .createSignedUrl(path, 60 * 60);

  if (error) {
    console.error('No se pudo crear el enlace temporal del archivo.', error);
  }

  return {
    name: metadata.name || 'Archivo médico',
    type: metadata.type || 'application/octet-stream',
    size: Number(metadata.size || 0),
    dataUrl: data?.signedUrl || '',
    storagePath: path,
  };
}

async function mapVaccineRow(client, row) {
  const proofFile = row.proof_storage_path
    ? await createSignedFile(client, row.proof_storage_path, {
        name: row.proof_file_name,
        type: row.proof_mime_type,
        size: row.proof_size_bytes,
      })
    : null;

  return {
    id: row.id,
    childId: row.child_id,
    vaccineName: row.vaccine_name,
    recordStatus: row.record_status || 'applied',
    applicationDate: row.application_date || '',
    nextDoseDate: row.next_dose_date || '',
    doseLabel: row.dose_label || '',
    observations: row.observations || '',
    lotNumber: row.lot_number || '',
    vaccinationCenter: row.vaccination_center || '',
    professionalName: row.professional_name || '',
    proofFile,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function mapDocumentRow(client, row) {
  const file = row.storage_path
    ? await createSignedFile(client, row.storage_path, {
        name: row.file_name,
        type: row.mime_type,
        size: row.size_bytes,
      })
    : null;

  return {
    id: row.id,
    childId: row.child_id,
    consultationId: row.consultation_id || '',
    treatmentId: row.treatment_id || '',
    documentType: row.document_type || 'prescription',
    title: row.title,
    documentDate: row.document_date,
    professionalName: row.professional_name || '',
    medicalCenter: row.medical_center || '',
    notes: row.notes || '',
    file,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapCabinetRow(row) {
  return {
    id: row.id,
    childId: row.child_id,
    treatmentId: row.treatment_id || '',
    medicineName: row.medicine_name,
    presentation: row.presentation || '',
    currentStock: Number(row.current_stock || 0),
    initialStock: Number(row.initial_stock || 0),
    minimumStock: Number(row.minimum_stock || 0),
    consumptionPerDose: Number(row.consumption_per_dose || 1),
    stockUnit: row.stock_unit || 'dose',
    expirationDate: row.expiration_date || '',
    lotNumber: row.lot_number || '',
    storageLocation: row.storage_location || '',
    notes: row.notes || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapUsageRow(row) {
  return {
    id: row.id,
    reminderId: row.reminder_id,
    treatmentId: row.treatment_id,
    itemId: row.item_id,
    consumedAmount: Number(row.consumed_amount || 0),
    previousStock: Number(row.previous_stock || 0),
    resultingStock: Number(row.resulting_stock || 0),
    createdAt: row.created_at,
  };
}

function mapPaymentRow(row, familyNameById = new Map()) {
  return {
    id: row.id,
    familyId: row.family_id,
    familyName: familyNameById.get(row.family_id) || 'Familia',
    plan: '',
    amount: Number(row.amount_ars || 0),
    paymentDate: row.paid_at,
    type: 'activation',
    paymentMethod: row.payment_method || 'bank_transfer',
    paymentReference: row.payment_reference || '',
    notes: row.notes || '',
    activatedBy: 'Administración',
  };
}

function checkQueryError(error, label) {
  if (error) {
    throw new Error(
      error.message || `No se pudo cargar ${label}.`,
    );
  }
}

async function fetchFamilyRows(client, table, familyId) {
  const { data, error } = await client
    .from(table)
    .select('*')
    .eq('family_id', familyId);

  checkQueryError(error, table);
  return data || [];
}

export function runWithoutRemoteSync(callback) {
  suppressRemoteSync += 1;

  try {
    return callback();
  } finally {
    suppressRemoteSync = Math.max(0, suppressRemoteSync - 1);
  }
}

export async function loadAdminCache() {
  const client = requireSupabase();

  const [
    familiesResult,
    membersResult,
    caregiversResult,
    profilesResult,
    paymentsResult,
    subscriptionsResult,
  ] = await Promise.all([
    client.from('families').select('*'),
    client.from('family_members').select('*'),
    client.from('caregivers').select('*'),
    client.from('profiles').select('*'),
    client.from('subscription_payments').select('*'),
    client.from('subscriptions').select('*'),
  ]);

  checkQueryError(familiesResult.error, 'las familias');
  checkQueryError(membersResult.error, 'los miembros');
  checkQueryError(caregiversResult.error, 'los responsables');
  checkQueryError(profilesResult.error, 'los perfiles');
  checkQueryError(paymentsResult.error, 'los pagos');
  checkQueryError(subscriptionsResult.error, 'las suscripciones');

  const profilesById = new Map(
    (profilesResult.data || []).map((profile) => [profile.id, profile]),
  );

  const primaryCaregiverByFamily = new Map();
  for (const caregiver of caregiversResult.data || []) {
    if (caregiver.is_primary) {
      primaryCaregiverByFamily.set(caregiver.family_id, caregiver);
    }
  }

  const ownerMemberByFamily = new Map();
  for (const member of membersResult.data || []) {
    if (member.member_role === 'owner' && member.status === 'active') {
      ownerMemberByFamily.set(member.family_id, member);
    }
  }

  const families = (familiesResult.data || []).map((family) => {
    const ownerMember = ownerMemberByFamily.get(family.id);
    const ownerProfile = ownerMember
      ? profilesById.get(ownerMember.user_id)
      : profilesById.get(family.created_by);

    return mapFamilyRow(
      family,
      ownerProfile,
      primaryCaregiverByFamily.get(family.id),
    );
  });

  const familyNameById = new Map(
    families.map((family) => [family.id, family.familyName]),
  );

  const subscriptionById = new Map(
    (subscriptionsResult.data || []).map((subscription) => [
      subscription.id,
      subscription,
    ]),
  );

  const payments = (paymentsResult.data || []).map((payment) => {
    const mapped = mapPaymentRow(payment, familyNameById);
    const subscription = payment.subscription_id
      ? subscriptionById.get(payment.subscription_id)
      : null;

    if (subscription) {
      mapped.plan = subscription.plan;
    }

    return mapped;
  });

  runWithoutRemoteSync(() => {
    writeJson(STORAGE_KEYS.adminFamilies, families);
    writeJson(STORAGE_KEYS.adminPayments, payments);
  });

  return { families, payments };
}

export async function loadFamilyCache(familyId, user = null) {
  const client = requireSupabase();

  const [
    familyResult,
    memberResult,
    profileResult,
    caregiversResult,
    membersResult,
    settingsResult,
    childrenResult,
    consultationsResult,
    treatmentsResult,
    remindersResult,
    vaccinesResult,
    documentsResult,
    cabinetResult,
    usageResult,
  ] = await Promise.all([
    client.from('families').select('*').eq('id', familyId).single(),
    user
      ? client
          .from('family_members')
          .select('*')
          .eq('family_id', familyId)
          .eq('user_id', user.id)
          .eq('status', 'active')
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    user
      ? client.from('profiles').select('*').eq('id', user.id).single()
      : Promise.resolve({ data: null, error: null }),
    fetchFamilyRows(client, 'caregivers', familyId).then((data) => ({
      data,
      error: null,
    })),
    fetchFamilyRows(client, 'family_members', familyId).then((data) => ({
      data,
      error: null,
    })),
    client
      .from('family_settings')
      .select('*')
      .eq('family_id', familyId)
      .maybeSingle(),
    fetchFamilyRows(client, 'children', familyId).then((data) => ({
      data,
      error: null,
    })),
    fetchFamilyRows(client, 'consultations', familyId).then((data) => ({
      data,
      error: null,
    })),
    fetchFamilyRows(client, 'treatments', familyId).then((data) => ({
      data,
      error: null,
    })),
    fetchFamilyRows(client, 'reminder_records', familyId).then((data) => ({
      data,
      error: null,
    })),
    fetchFamilyRows(client, 'vaccines', familyId).then((data) => ({
      data,
      error: null,
    })),
    fetchFamilyRows(client, 'medical_documents', familyId).then((data) => ({
      data,
      error: null,
    })),
    fetchFamilyRows(client, 'medicine_cabinet_items', familyId).then((data) => ({
      data,
      error: null,
    })),
    fetchFamilyRows(client, 'medicine_stock_usage', familyId).then((data) => ({
      data,
      error: null,
    })),
  ]);

  checkQueryError(familyResult.error, 'la familia');
  checkQueryError(memberResult.error, 'la membresía');
  checkQueryError(profileResult.error, 'el perfil');
  checkQueryError(settingsResult.error, 'la configuración');

  const memberByCaregiverId = new Map(
    (membersResult.data || [])
      .filter((member) => member.caregiver_id)
      .map((member) => [member.caregiver_id, member]),
  );

  const caregivers = (caregiversResult.data || []).map((row) =>
    mapCaregiverRow(row, memberByCaregiverId),
  );

  const primaryCaregiver = caregiversResult.data?.find(
    (caregiver) => caregiver.is_primary,
  );

  const family = mapFamilyRow(
    familyResult.data,
    profileResult.data,
    primaryCaregiver,
  );

  const settings = mapSettingsRow(settingsResult.data, familyResult.data);
  const children = (childrenResult.data || []).map(mapChildRow);
  const consultations = (consultationsResult.data || []).map(mapConsultationRow);
  const treatments = (treatmentsResult.data || []).map(mapTreatmentRow);
  const reminders = (remindersResult.data || []).map(mapReminderRow);
  const vaccines = await Promise.all(
    (vaccinesResult.data || []).map((row) => mapVaccineRow(client, row)),
  );
  const documents = await Promise.all(
    (documentsResult.data || []).map((row) => mapDocumentRow(client, row)),
  );
  const cabinet = (cabinetResult.data || []).map(mapCabinetRow);
  const usage = (usageResult.data || []).map(mapUsageRow);

  setHydratedRows(
    STORAGE_KEYS.children,
    children.map((item) => childToRow(item, familyId)),
  );
  setHydratedRows(
    STORAGE_KEYS.consultations,
    consultations.map((item) => consultationToRow(item, familyId)),
  );
  setHydratedRows(
    STORAGE_KEYS.treatments,
    treatments.map((item) => treatmentToRow(item, familyId)),
  );
  setHydratedRows(
    STORAGE_KEYS.reminders,
    reminders.map((item) => reminderToRow(item, familyId)),
  );
  setHydratedRows(
    STORAGE_KEYS.vaccines,
    (vaccinesResult.data || []).map(vaccineDatabaseRowForSync),
  );
  setHydratedRows(
    STORAGE_KEYS.documents,
    (documentsResult.data || []).map(documentDatabaseRowForSync),
  );
  setHydratedRows(
    STORAGE_KEYS.medicineCabinet,
    cabinet.map((item) => cabinetToRow(item, familyId)),
  );

  const currentMember = memberResult.data;
  const currentUser = profileResult.data
    ? mapProfileToUser(profileResult.data, currentMember)
    : null;

  runWithoutRemoteSync(() => {
    localStorage.setItem(STORAGE_KEYS.currentFamilyId, familyId);
    writeJson(STORAGE_KEYS.adminFamilies, [family]);
    writeJson(STORAGE_KEYS.settings, settings);
    writeJson(STORAGE_KEYS.caregivers, caregivers);
    localStorage.setItem(
      STORAGE_KEYS.activeCaregiver,
      settings.defaultCaregiverId ||
        caregivers.find((caregiver) => caregiver.isPrimary)?.id ||
        caregivers.find((caregiver) => caregiver.isActive)?.id ||
        '',
    );
    writeJson(STORAGE_KEYS.children, children);
    writeJson(STORAGE_KEYS.consultations, consultations);
    writeJson(STORAGE_KEYS.treatments, treatments);
    writeJson(STORAGE_KEYS.reminders, reminders);
    writeJson(STORAGE_KEYS.vaccines, vaccines);
    writeJson(STORAGE_KEYS.documents, documents);
    writeJson(STORAGE_KEYS.medicineCabinet, cabinet);
    writeJson(STORAGE_KEYS.medicineUsage, usage);

    if (currentUser) {
      writeJson(STORAGE_KEYS.users, [currentUser]);
    }
  });

  return {
    family,
    user: currentUser,
    member: currentMember,
  };
}

export async function loadCurrentAccountCache(authUser) {
  if (!authUser) {
    return null;
  }

  const client = requireSupabase();

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .single();

  checkQueryError(profileError, 'el perfil');

  if (profile.status !== 'active') {
    throw new Error('Esta cuenta se encuentra deshabilitada.');
  }

  if (profile.app_role === 'admin') {
    await loadAdminCache();

    const cachedUser = mapProfileToUser(profile);
    const session = {
      userId: authUser.id,
      familyId: '',
      role: 'admin',
      signedInAt: new Date().toISOString(),
    };

    runWithoutRemoteSync(() => {
      localStorage.removeItem(STORAGE_KEYS.currentFamilyId);
      writeJson(STORAGE_KEYS.users, [cachedUser]);
      writeJson(STORAGE_KEYS.session, session);
    });

    return {
      session,
      user: cachedUser,
      family: null,
    };
  }

  const { data: member, error: memberError } = await client
    .from('family_members')
    .select('*')
    .eq('user_id', authUser.id)
    .eq('status', 'active')
    .maybeSingle();

  checkQueryError(memberError, 'la familia de la cuenta');

  if (!member) {
    return {
      session: null,
      user: mapProfileToUser(profile),
      family: null,
      missingFamily: true,
    };
  }

  const context = await loadFamilyCache(member.family_id, authUser);
  const session = {
    userId: authUser.id,
    familyId: member.family_id,
    role: member.member_role || 'member',
    accessLevel:
      member.member_role === 'owner'
        ? 'full_access'
        : member.access_level || 'full_access',
    signedInAt: new Date().toISOString(),
  };

  runWithoutRemoteSync(() => {
    writeJson(STORAGE_KEYS.session, session);
  });

  return {
    session,
    user: context.user,
    family: context.family,
  };
}

export function clearCachedAccount() {
  hydratedIdsByStorageKey.clear();
  hydratedRowFingerprintsByStorageKey.clear();
  pendingSyncKeys.clear();

  if (syncTimer) {
    window.clearTimeout(syncTimer);
    syncTimer = null;
  }

  runWithoutRemoteSync(() => {
    for (const key of Object.values(STORAGE_KEYS)) {
      localStorage.removeItem(key);
    }

    const familyBucketKeys = [];

    for (
      let index = 0;
      index < localStorage.length;
      index += 1
    ) {
      const key = localStorage.key(index);

      if (
        key?.startsWith(
          'mipeque-family-bucket::',
        )
      ) {
        familyBucketKeys.push(key);
      }
    }

    familyBucketKeys.forEach((key) => {
      localStorage.removeItem(key);
    });
  });
}

export async function initializeSupabaseCache() {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    if (!isSupabaseConfigured) {
      return null;
    }

    const client = requireSupabase();
    const { data, error } = await client.auth.getUser();

    if (error || !data?.user) {
      clearCachedAccount();
      return null;
    }

    const context = await loadCurrentAccountCache(
      data.user,
    );

    if (context?.missingFamily) {
      clearCachedAccount();
      await client.auth.signOut();
      return null;
    }

    return context;
  })().finally(() => {
    initializationPromise = null;
  });

  return initializationPromise;
}

function safeFileName(fileName = 'archivo') {
  const normalized = String(fileName)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);

  return normalized || 'archivo';
}

function dataUrlToBlob(dataUrl) {
  const [metadata, encodedData] = String(dataUrl).split(',');

  if (!metadata || encodedData === undefined) {
    throw new Error('El archivo seleccionado no tiene un formato válido.');
  }

  const mimeMatch = metadata.match(/data:([^;]+)/);
  const mimeType = mimeMatch?.[1] || 'application/octet-stream';
  const isBase64 = metadata.includes(';base64');
  const binary = isBase64
    ? atob(encodedData)
    : decodeURIComponent(encodedData);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType });
}

async function uploadCachedFile(client, familyId, recordId, file, folder) {
  if (!file?.dataUrl) {
    return file?.storagePath || null;
  }

  if (!String(file.dataUrl).startsWith('data:')) {
    return file.storagePath || null;
  }

  const path = `${familyId}/${folder}/${recordId}/${safeFileName(file.name)}`;
  const blob = dataUrlToBlob(file.dataUrl);

  const { error } = await client.storage
    .from('medical-files')
    .upload(path, blob, {
      contentType: file.type || blob.type,
      upsert: true,
    });

  if (error) {
    throw new Error(error.message || 'No se pudo subir el archivo médico.');
  }

  return path;
}

async function deleteKnownMissingRows(
  client,
  table,
  familyId,
  storageKey,
  localIds,
) {
  const missingIds =
    getKnownDeletedIds(
      storageKey,
      localIds,
    );

  if (missingIds.length === 0) {
    return;
  }

  const { error } = await client
    .from(table)
    .delete()
    .eq('family_id', familyId)
    .in('id', missingIds);

  if (error) {
    throw new Error(
      error.message ||
        `No se pudieron eliminar registros de ${table}.`,
    );
  }

}

async function replaceRows(
  client,
  table,
  familyId,
  storageKey,
  rows,
) {
  const localIds =
    rows.map((row) => row.id);

  const changedRows =
    getChangedRows(
      storageKey,
      rows,
    );

  if (changedRows.length > 0) {
    const { error } =
      await client.from(table).upsert(
        changedRows,
        {
          onConflict: 'id',
        },
      );

    if (error) {
      throw new Error(
        error.message ||
          `No se pudo guardar ${table}.`,
      );
    }
  }

  await deleteKnownMissingRows(
    client,
    table,
    familyId,
    storageKey,
    localIds,
  );

  setHydratedRows(
    storageKey,
    rows,
  );
}

function childToRow(child, familyId) {
  return {
    id: child.id,
    family_id: familyId,
    full_name: child.fullName,
    birth_date: child.birthDate,
    blood_type: nullable(child.bloodType),
    weight: numberOrNull(child.weight),
    height: numberOrNull(child.height),
    allergies: child.allergies || '',
    medical_history: child.medicalHistory || '',
    health_insurance: child.healthInsurance || '',
    member_number: child.memberNumber || '',
    pediatrician_name: child.pediatricianName || '',
    pediatrician_phone: child.pediatricianPhone || '',
    emergency_contact_name: child.emergencyContactName || '',
    emergency_contact_phone: child.emergencyContactPhone || '',
    notes: child.notes || '',
  };
}

function consultationToRow(consultation, familyId) {
  return {
    id: consultation.id,
    family_id: familyId,
    child_id: consultation.childId,
    consultation_date: consultation.consultationDate,
    consultation_time: nullable(consultation.consultationTime),
    consultation_type: consultation.consultationType || 'pediatric',
    reason: consultation.reason,
    symptoms: consultation.symptoms || '',
    diagnosis: consultation.diagnosis || '',
    professional_name: consultation.professionalName || '',
    specialty: consultation.specialty || '',
    medical_center: consultation.medicalCenter || '',
    weight: numberOrNull(consultation.weight),
    temperature: numberOrNull(consultation.temperature),
    indications: consultation.indications || '',
    follow_up_date: nullable(consultation.followUpDate),
    notes: consultation.notes || '',
  };
}

function treatmentToRow(treatment, familyId) {
  const isInterval = treatment.frequencyMode !== 'custom';

  return {
    id: treatment.id,
    family_id: familyId,
    child_id: treatment.childId,
    consultation_id: nullable(treatment.consultationId),
    medication_name: treatment.medicationName,
    presentation: treatment.presentation || '',
    dosage_instruction: treatment.dosageInstruction,
    administration_route: treatment.administrationRoute || 'oral',
    start_date: treatment.startDate,
    duration_days: Number(treatment.durationDays),
    end_date: treatment.endDate,
    frequency_mode: isInterval ? 'interval' : 'custom',
    interval_hours: isInterval ? Number(treatment.intervalHours) : null,
    first_dose_time: isInterval ? nullable(treatment.firstDoseTime) : null,
    custom_times: isInterval ? [] : treatment.customTimes || [],
    status: treatment.status || 'active',
    notes: treatment.notes || '',
  };
}

function reminderToRow(reminder, familyId) {
  return {
    id: reminder.id,
    family_id: familyId,
    treatment_id: reminder.treatmentId,
    child_id: reminder.childId,
    status: reminder.status || 'pending',
    scheduled_at: reminder.scheduledAt,
    original_time: reminder.originalTime,
    postponed_until: nullable(reminder.postponedUntil),
    completed_at: nullable(reminder.completedAt),
    responsible_caregiver_id: nullable(reminder.responsibleId),
    responsible_name: reminder.responsibleName || '',
    medication_name: reminder.medicationName || '',
    presentation: reminder.presentation || '',
    dosage_instruction: reminder.dosageInstruction || '',
    child_name: reminder.childName || '',
    notes: reminder.notes || '',
  };
}

function cabinetToRow(item, familyId) {
  return {
    id: item.id,
    family_id: familyId,
    child_id: item.childId,
    treatment_id: nullable(item.treatmentId),
    medicine_name: item.medicineName,
    presentation: item.presentation || '',
    current_stock: numberOrZero(item.currentStock),
    initial_stock: numberOrZero(item.initialStock ?? item.currentStock),
    minimum_stock: numberOrZero(item.minimumStock),
    consumption_per_dose: numberOrNull(item.consumptionPerDose) || 1,
    stock_unit: item.stockUnit || 'dose',
    expiration_date: nullable(item.expirationDate),
    lot_number: item.lotNumber || '',
    storage_location: item.storageLocation || '',
    notes: item.notes || '',
  };
}

async function syncSettings(client, familyId) {
  const settings = readJson(STORAGE_KEYS.settings, {});

  if (settings.familyName) {
    const { error: familyError } = await client
      .from('families')
      .update({ family_name: settings.familyName.trim() })
      .eq('id', familyId);

    if (familyError) {
      throw new Error(familyError.message || 'No se pudo actualizar la familia.');
    }
  }

  const row = {
    family_id: familyId,
    contact_name: settings.contactName || '',
    contact_email: settings.contactEmail || '',
    phone: settings.phone || '',
    default_caregiver_id: nullable(settings.defaultCaregiverId),
    reminder_advance_minutes: Number(settings.reminderAdvanceMinutes ?? 15),
    expiration_warning_days: Number(settings.expirationWarningDays ?? 30),
    vaccine_warning_days: Number(settings.vaccineWarningDays ?? 30),
    show_overdue_alerts: settings.showOverdueAlerts ?? true,
    show_stock_alerts: settings.showStockAlerts ?? true,
    show_expiration_alerts: settings.showExpirationAlerts ?? true,
    show_vaccine_alerts: settings.showVaccineAlerts ?? true,
  };

  const { error } = await client.from('family_settings').upsert(row, {
    onConflict: 'family_id',
  });

  if (error) {
    throw new Error(error.message || 'No se pudo guardar la configuración.');
  }
}

function vaccineDatabaseRowForSync(row) {
  return {
    id: row.id,
    family_id: row.family_id,
    child_id: row.child_id,
    vaccine_name: row.vaccine_name,
    record_status: row.record_status || 'applied',
    application_date: row.application_date || null,
    next_dose_date: row.next_dose_date || null,
    dose_label: row.dose_label || '',
    observations: row.observations || '',
    lot_number: row.lot_number || '',
    vaccination_center: row.vaccination_center || '',
    professional_name: row.professional_name || '',
    proof_storage_path: row.proof_storage_path || null,
    proof_file_name: row.proof_file_name || null,
    proof_mime_type: row.proof_mime_type || null,
    proof_size_bytes: row.proof_size_bytes || null,
  };
}

function documentDatabaseRowForSync(row) {
  return {
    id: row.id,
    family_id: row.family_id,
    child_id: row.child_id,
    consultation_id: row.consultation_id || null,
    treatment_id: row.treatment_id || null,
    document_type: row.document_type || 'prescription',
    title: row.title,
    document_date: row.document_date,
    professional_name: row.professional_name || '',
    medical_center: row.medical_center || '',
    notes: row.notes || '',
    storage_path: row.storage_path || null,
    file_name: row.file_name || null,
    mime_type: row.mime_type || null,
    size_bytes: row.size_bytes || null,
  };
}

async function syncVaccines(client, familyId) {
  const vaccines = readJson(STORAGE_KEYS.vaccines, []);
  const { data: existingRows, error: existingError } = await client
    .from('vaccines')
    .select('id, proof_storage_path')
    .eq('family_id', familyId);

  if (existingError) {
    throw new Error(existingError.message || 'No se pudieron revisar las vacunas.');
  }

  const existingById = new Map((existingRows || []).map((row) => [row.id, row]));
  const rows = [];

  for (const vaccine of vaccines) {
    const storagePath = vaccine.proofFile
      ? await uploadCachedFile(
          client,
          familyId,
          vaccine.id,
          vaccine.proofFile,
          'vaccines',
        )
      : null;

    const previousPath = existingById.get(vaccine.id)?.proof_storage_path;
    if (previousPath && previousPath !== storagePath) {
      await client.storage.from('medical-files').remove([previousPath]);
    }

    rows.push({
      id: vaccine.id,
      family_id: familyId,
      child_id: vaccine.childId,
      vaccine_name: vaccine.vaccineName,
      record_status: vaccine.recordStatus || 'applied',
      application_date: nullable(vaccine.applicationDate),
      next_dose_date: nullable(vaccine.nextDoseDate),
      dose_label: vaccine.doseLabel || '',
      observations: vaccine.observations || '',
      lot_number: vaccine.lotNumber || '',
      vaccination_center: vaccine.vaccinationCenter || '',
      professional_name: vaccine.professionalName || '',
      proof_storage_path: storagePath,
      proof_file_name: vaccine.proofFile?.name || null,
      proof_mime_type: vaccine.proofFile?.type || null,
      proof_size_bytes: vaccine.proofFile?.size || null,
    });
  }

  const changedRows = getChangedRows(
    STORAGE_KEYS.vaccines,
    rows,
  );

  if (changedRows.length > 0) {
    const { error } = await client.from('vaccines').upsert(changedRows, {
      onConflict: 'id',
    });

    if (error) {
      throw new Error(error.message || 'No se pudieron guardar las vacunas.');
    }
  }

  const localIds = rows.map((row) => row.id);
  const knownDeletedIds = new Set(
    getKnownDeletedIds(
      STORAGE_KEYS.vaccines,
      localIds,
    ),
  );
  const pathsToDelete = (existingRows || [])
    .filter((row) => knownDeletedIds.has(row.id))
    .map((row) => row.proof_storage_path)
    .filter(Boolean);

  if (pathsToDelete.length > 0) {
    await client.storage.from('medical-files').remove(pathsToDelete);
  }

  await deleteKnownMissingRows(
    client,
    'vaccines',
    familyId,
    STORAGE_KEYS.vaccines,
    localIds,
  );

  setHydratedRows(
    STORAGE_KEYS.vaccines,
    rows,
  );
}

async function syncDocuments(client, familyId) {
  const documents = readJson(STORAGE_KEYS.documents, []);
  const { data: existingRows, error: existingError } = await client
    .from('medical_documents')
    .select('id, storage_path')
    .eq('family_id', familyId);

  if (existingError) {
    throw new Error(existingError.message || 'No se pudieron revisar los documentos.');
  }

  const existingById = new Map((existingRows || []).map((row) => [row.id, row]));
  const rows = [];

  for (const document of documents) {
    const storagePath = document.file
      ? await uploadCachedFile(
          client,
          familyId,
          document.id,
          document.file,
          'documents',
        )
      : null;

    const previousPath = existingById.get(document.id)?.storage_path;
    if (previousPath && previousPath !== storagePath) {
      await client.storage.from('medical-files').remove([previousPath]);
    }

    rows.push({
      id: document.id,
      family_id: familyId,
      child_id: document.childId,
      consultation_id: nullable(document.consultationId),
      treatment_id: nullable(document.treatmentId),
      document_type: document.documentType || 'prescription',
      title: document.title,
      document_date: document.documentDate,
      professional_name: document.professionalName || '',
      medical_center: document.medicalCenter || '',
      notes: document.notes || '',
      storage_path: storagePath,
      file_name: document.file?.name || null,
      mime_type: document.file?.type || null,
      size_bytes: document.file?.size || null,
    });
  }

  const changedRows = getChangedRows(
    STORAGE_KEYS.documents,
    rows,
  );

  if (changedRows.length > 0) {
    const { error } = await client.from('medical_documents').upsert(changedRows, {
      onConflict: 'id',
    });

    if (error) {
      throw new Error(error.message || 'No se pudieron guardar los documentos.');
    }
  }

  const localIds = rows.map((row) => row.id);
  const knownDeletedIds = new Set(
    getKnownDeletedIds(
      STORAGE_KEYS.documents,
      localIds,
    ),
  );
  const pathsToDelete = (existingRows || [])
    .filter((row) => knownDeletedIds.has(row.id))
    .map((row) => row.storage_path)
    .filter(Boolean);

  if (pathsToDelete.length > 0) {
    await client.storage.from('medical-files').remove(pathsToDelete);
  }

  await deleteKnownMissingRows(
    client,
    'medical_documents',
    familyId,
    STORAGE_KEYS.documents,
    localIds,
  );

  setHydratedRows(
    STORAGE_KEYS.documents,
    rows,
  );
}

export async function syncStorageKey(storageKey) {
  if (!SYNCABLE_KEYS.has(storageKey)) {
    return;
  }

  const session = getCachedSession();
  const familyId = getCurrentFamilyId();

  if (!session || session.role === 'admin' || !familyId) {
    return;
  }

  const client = requireSupabase();

  switch (storageKey) {
    case STORAGE_KEYS.settings:
      await syncSettings(client, familyId);
      break;

    case STORAGE_KEYS.children:
      await replaceRows(
        client,
        'children',
        familyId,
        STORAGE_KEYS.children,
        readJson(STORAGE_KEYS.children, []).map((item) =>
          childToRow(item, familyId),
        ),
      );
      break;

    case STORAGE_KEYS.consultations:
      await replaceRows(
        client,
        'consultations',
        familyId,
        STORAGE_KEYS.consultations,
        readJson(STORAGE_KEYS.consultations, []).map((item) =>
          consultationToRow(item, familyId),
        ),
      );
      break;

    case STORAGE_KEYS.treatments:
      await replaceRows(
        client,
        'treatments',
        familyId,
        STORAGE_KEYS.treatments,
        readJson(STORAGE_KEYS.treatments, []).map((item) =>
          treatmentToRow(item, familyId),
        ),
      );
      break;

    case STORAGE_KEYS.reminders: {
      const validReminders = readJson(STORAGE_KEYS.reminders, []).filter(
        (item) =>
          item.id &&
          item.treatmentId &&
          item.childId &&
          item.scheduledAt &&
          item.originalTime,
      );

      await replaceRows(
        client,
        'reminder_records',
        familyId,
        STORAGE_KEYS.reminders,
        validReminders.map((item) => reminderToRow(item, familyId)),
      );
      break;
    }

    case STORAGE_KEYS.vaccines:
      await syncVaccines(client, familyId);
      break;

    case STORAGE_KEYS.documents:
      await syncDocuments(client, familyId);
      break;

    case STORAGE_KEYS.medicineCabinet:
      await replaceRows(
        client,
        'medicine_cabinet_items',
        familyId,
        STORAGE_KEYS.medicineCabinet,
        readJson(STORAGE_KEYS.medicineCabinet, []).map((item) =>
          cabinetToRow(item, familyId),
        ),
      );
      break;

    default:
      break;
  }
}

export function notifyFamilyDataChanged(storageKey) {
  if (
    suppressRemoteSync > 0 ||
    !isSupabaseConfigured ||
    !SYNCABLE_KEYS.has(storageKey)
  ) {
    return;
  }

  pendingSyncKeys.add(storageKey);

  if (syncTimer) {
    window.clearTimeout(syncTimer);
  }

  syncTimer = window.setTimeout(() => {
    flushPendingRemoteSync().catch((error) => {
      console.error('No se pudieron sincronizar los datos con Supabase.', error);

      window.dispatchEvent(
        new CustomEvent('mipeque-sync-error', {
          detail: {
            message:
              error.message ||
              'No se pudieron sincronizar algunos cambios. Revisá tu conexión.',
          },
        }),
      );
    });
  }, 450);
}

export async function flushPendingRemoteSync() {
  if (syncTimer) {
    window.clearTimeout(syncTimer);
    syncTimer = null;
  }

  const keys = SYNC_PRIORITY.filter((key) => pendingSyncKeys.has(key));
  pendingSyncKeys.clear();

  for (const key of keys) {
    await syncStorageKey(key);
  }
}

export async function syncAllFamilyData() {
  for (const key of SYNC_PRIORITY) {
    await syncStorageKey(key);
  }
}

export async function forceSyncAllFamilyData() {
  if (syncTimer) {
    window.clearTimeout(syncTimer);
    syncTimer = null;
  }

  pendingSyncKeys.clear();
  hydratedIdsByStorageKey.clear();
  hydratedRowFingerprintsByStorageKey.clear();

  for (const key of SYNC_PRIORITY) {
    await syncStorageKey(key);
  }
}

export { STORAGE_KEYS };
