import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-mipeque-cron-secret',
}

const DEFAULT_TIMEZONE =
  'America/Argentina/Buenos_Aires'

const DISPATCH_LOOKBACK_MS = 10 * 60 * 1000
const DISPATCH_FUTURE_MS = 30 * 1000
const OVERDUE_DELAY_MINUTES = 15

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_ANON_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') || ''
const SUPABASE_SERVICE_ROLE_KEY =
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const VAPID_PUBLIC_KEY =
  Deno.env.get('VAPID_PUBLIC_KEY') || ''
const VAPID_PRIVATE_KEY =
  Deno.env.get('VAPID_PRIVATE_KEY') || ''
const VAPID_SUBJECT =
  Deno.env.get('VAPID_SUBJECT') || ''

type PushSubscriptionRow = {
  id: string
  family_id: string
  user_id: string
  endpoint: string
  p256dh_key: string
  auth_key: string
  timezone: string | null
  notify_medication_due: boolean
  notify_medication_overdue: boolean
  notify_vaccines: boolean
  notify_expirations: boolean
  notify_stock: boolean
  notify_followups: boolean
  show_details: boolean
  is_enabled: boolean
}

type FamilySettingsRow = {
  family_id: string
  reminder_advance_minutes: number
  expiration_warning_days: number
  vaccine_warning_days: number
  show_overdue_alerts: boolean
  show_stock_alerts: boolean
  show_expiration_alerts: boolean
  show_vaccine_alerts: boolean
}

type MemberRow = {
  family_id: string
  user_id: string
  member_role: string
  status: string
  access_level?: string | null
}

type ChildRow = {
  id: string
  family_id: string
  full_name: string
}

type TreatmentRow = {
  id: string
  family_id: string
  child_id: string
  medication_name: string
  presentation: string
  dosage_instruction: string
  start_date: string
  end_date: string
  frequency_mode: 'interval' | 'custom'
  interval_hours: number | null
  first_dose_time: string | null
  custom_times: string[] | null
  status: string
}

type ReminderRecordRow = {
  id: string
  family_id: string
  treatment_id: string
  child_id: string
  status: string
  scheduled_at: string
  postponed_until: string | null
  medication_name: string
  dosage_instruction: string
  child_name: string
}

type VaccineRow = {
  id: string
  family_id: string
  child_id: string
  vaccine_name: string
  dose_label: string
  next_dose_date: string | null
}

type CabinetRow = {
  id: string
  family_id: string
  child_id: string
  medicine_name: string
  current_stock: number
  minimum_stock: number
  stock_unit: string
  expiration_date: string | null
}

type ConsultationRow = {
  id: string
  family_id: string
  child_id: string
  reason: string
  follow_up_date: string | null
}

type DeliveryRow = {
  subscription_id: string
  dedupe_key: string
}

type CandidateCategory =
  | 'medication_due'
  | 'medication_overdue'
  | 'medication_postponed'
  | 'vaccine'
  | 'expiration'
  | 'stock_low'
  | 'followup'

type Candidate = {
  familyId: string
  category: CandidateCategory
  referenceId: string
  dedupeKey: string
  sendAt: Date
  navigateTo: string
  privateTitle: string
  privateBody: string
  detailedTitle: string
  detailedBody: string
}

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function assertServerConfiguration() {
  const missing = [
    ['SUPABASE_URL', SUPABASE_URL],
    ['SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY],
    ['VAPID_PUBLIC_KEY', VAPID_PUBLIC_KEY],
    ['VAPID_PRIVATE_KEY', VAPID_PRIVATE_KEY],
    ['VAPID_SUBJECT', VAPID_SUBJECT],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name)

  if (missing.length > 0) {
    throw new Error(
      `Faltan secretos de configuración: ${missing.join(', ')}`,
    )
  }
}

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function normalizeTime(value?: string | null) {
  if (!value) {
    return ''
  }

  return String(value).slice(0, 5)
}

function getZonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  )

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  }
}

function zonedDateTimeToUtc(
  dateKey: string,
  timeValue: string,
  timezone: string,
) {
  const [year, month, day] = dateKey
    .split('-')
    .map(Number)

  const [hour, minute] = normalizeTime(timeValue)
    .split(':')
    .map(Number)

  if (
    !year ||
    !month ||
    !day ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null
  }

  const desiredUtcLike = Date.UTC(
    year,
    month - 1,
    day,
    hour,
    minute,
    0,
  )

  let guess = new Date(desiredUtcLike)

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const zoned = getZonedParts(guess, timezone)

    const zonedUtcLike = Date.UTC(
      zoned.year,
      zoned.month - 1,
      zoned.day,
      zoned.hour,
      zoned.minute,
      zoned.second,
    )

    const difference = desiredUtcLike - zonedUtcLike

    if (difference === 0) {
      break
    }

    guess = new Date(guess.getTime() + difference)
  }

  return guess
}

function formatLocalDateKey(date: Date, timezone: string) {
  const parts = getZonedParts(date, timezone)

  return [
    parts.year,
    pad(parts.month),
    pad(parts.day),
  ].join('-')
}

function formatLocalTime(date: Date, timezone: string) {
  const parts = getZonedParts(date, timezone)
  return `${pad(parts.hour)}:${pad(parts.minute)}`
}

function addDaysToDateKey(dateKey: string, days: number) {
  const [year, month, day] = dateKey
    .split('-')
    .map(Number)

  const date = new Date(
    Date.UTC(year, month - 1, day),
  )

  date.setUTCDate(date.getUTCDate() + days)

  return [
    date.getUTCFullYear(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
  ].join('-')
}

function isInsideDispatchWindow(sendAt: Date, now: Date) {
  const difference = sendAt.getTime() - now.getTime()

  return (
    difference >= -DISPATCH_LOOKBACK_MS &&
    difference <= DISPATCH_FUTURE_MS
  )
}

function createReminderId(
  treatmentId: string,
  scheduledAt: Date,
  timezone: string,
) {
  const dateKey = formatLocalDateKey(
    scheduledAt,
    timezone,
  )

  const time = formatLocalTime(
    scheduledAt,
    timezone,
  ).replace(':', '')

  return `${treatmentId}-${dateKey}-${time}`
}

function createMedicationCandidates({
  treatment,
  child,
  settings,
  timezone,
  now,
}: {
  treatment: TreatmentRow
  child?: ChildRow
  settings: FamilySettingsRow
  timezone: string
  now: Date
}) {
  const candidates: Candidate[] = []

  if (
    !['active', 'scheduled'].includes(treatment.status)
  ) {
    return candidates
  }

  const advanceMinutes = Math.max(
    0,
    Math.min(
      1440,
      Number(settings.reminder_advance_minutes || 0),
    ),
  )

  const firstDoseTime = normalizeTime(
    treatment.first_dose_time,
  )

  const endUtc = zonedDateTimeToUtc(
    treatment.end_date,
    '23:59',
    timezone,
  )

  const addOccurrence = (scheduledAt: Date) => {
    if (
      endUtc &&
      scheduledAt.getTime() > endUtc.getTime()
    ) {
      return
    }

    const reminderId = createReminderId(
      treatment.id,
      scheduledAt,
      timezone,
    )

    const localTime = formatLocalTime(
      scheduledAt,
      timezone,
    )

    const childName =
      child?.full_name || 'uno de tus hijos'

    const dueSendAt = new Date(
      scheduledAt.getTime() -
        advanceMinutes * 60 * 1000,
    )

    if (isInsideDispatchWindow(dueSendAt, now)) {
      candidates.push({
        familyId: treatment.family_id,
        category: 'medication_due',
        referenceId: reminderId,
        dedupeKey: `med-due:${reminderId}:${advanceMinutes}`,
        sendAt: dueSendAt,
        navigateTo: '/dashboard/reminders',
        privateTitle: 'Toma programada',
        privateBody:
          advanceMinutes > 0
            ? `Tenés una toma dentro de ${advanceMinutes} min en MiPeque.`
            : 'Tenés una toma para registrar ahora en MiPeque.',
        detailedTitle: `Toma de ${treatment.medication_name}`,
        detailedBody:
          `${childName} · ${treatment.dosage_instruction} · ${localTime}`,
      })
    }

    if (settings.show_overdue_alerts) {
      const overdueSendAt = new Date(
        scheduledAt.getTime() +
          OVERDUE_DELAY_MINUTES * 60 * 1000,
      )

      if (
        isInsideDispatchWindow(overdueSendAt, now)
      ) {
        candidates.push({
          familyId: treatment.family_id,
          category: 'medication_overdue',
          referenceId: reminderId,
          dedupeKey: `med-overdue:${reminderId}`,
          sendAt: overdueSendAt,
          navigateTo: '/dashboard/reminders',
          privateTitle: 'Toma pendiente',
          privateBody:
            'Hay una toma que todavía no fue registrada en MiPeque.',
          detailedTitle: `Toma pendiente · ${treatment.medication_name}`,
          detailedBody:
            `${childName} · estaba programada para las ${localTime}`,
        })
      }
    }
  }

  const scheduledRangeStart = new Date(
    now.getTime() - 2 * 60 * 60 * 1000,
  )

  const scheduledRangeEnd = new Date(
    now.getTime() +
      (advanceMinutes + 30) * 60 * 1000,
  )

  if (
    treatment.frequency_mode === 'interval' &&
    treatment.interval_hours &&
    firstDoseTime
  ) {
    const firstUtc = zonedDateTimeToUtc(
      treatment.start_date,
      firstDoseTime,
      timezone,
    )

    if (!firstUtc) {
      return candidates
    }

    const intervalMs =
      Number(treatment.interval_hours) *
      60 * 60 * 1000

    if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
      return candidates
    }

    const firstTime = firstUtc.getTime()
    const startIndex = Math.max(
      0,
      Math.floor(
        (scheduledRangeStart.getTime() - firstTime) /
          intervalMs,
      ) - 2,
    )

    const endIndex = Math.max(
      startIndex,
      Math.ceil(
        (scheduledRangeEnd.getTime() - firstTime) /
          intervalMs,
      ) + 2,
    )

    for (
      let index = startIndex;
      index <= endIndex && index - startIndex < 100;
      index += 1
    ) {
      const occurrence = new Date(
        firstTime + index * intervalMs,
      )

      if (
        occurrence < scheduledRangeStart ||
        occurrence > scheduledRangeEnd
      ) {
        continue
      }

      addOccurrence(occurrence)
    }

    return candidates
  }

  if (treatment.frequency_mode === 'custom') {
    const times = Array.isArray(treatment.custom_times)
      ? treatment.custom_times
          .map(normalizeTime)
          .filter(Boolean)
      : []

    const todayKey = formatLocalDateKey(now, timezone)

    for (let dayOffset = -2; dayOffset <= 2; dayOffset += 1) {
      const dateKey = addDaysToDateKey(
        todayKey,
        dayOffset,
      )

      if (
        dateKey < treatment.start_date ||
        dateKey > treatment.end_date
      ) {
        continue
      }

      for (const time of times) {
        const occurrence = zonedDateTimeToUtc(
          dateKey,
          time,
          timezone,
        )

        if (
          !occurrence ||
          occurrence < scheduledRangeStart ||
          occurrence > scheduledRangeEnd
        ) {
          continue
        }

        addOccurrence(occurrence)
      }
    }
  }

  return candidates
}

function createDateNotificationCandidates({
  familyId,
  referenceId,
  dateKey,
  warningDays,
  timezone,
  now,
  category,
  navigateTo,
  privateTitle,
  privateBody,
  detailedTitle,
  detailedBody,
}: {
  familyId: string
  referenceId: string
  dateKey: string
  warningDays: number
  timezone: string
  now: Date
  category: 'vaccine' | 'expiration'
  navigateTo: string
  privateTitle: string
  privateBody: string
  detailedTitle: string
  detailedBody: string
}) {
  const candidates: Candidate[] = []

  const normalizedWarningDays = Math.max(
    0,
    Math.min(365, Number(warningDays || 0)),
  )

  if (normalizedWarningDays > 0) {
    const warningDateKey = addDaysToDateKey(
      dateKey,
      -normalizedWarningDays,
    )

    const warningAt = zonedDateTimeToUtc(
      warningDateKey,
      '09:00',
      timezone,
    )

    if (
      warningAt &&
      isInsideDispatchWindow(warningAt, now)
    ) {
      candidates.push({
        familyId,
        category,
        referenceId,
        dedupeKey:
          `${category}-warning:${referenceId}:${dateKey}:${normalizedWarningDays}`,
        sendAt: warningAt,
        navigateTo,
        privateTitle,
        privateBody,
        detailedTitle,
        detailedBody,
      })
    }
  }

  const dueAt = zonedDateTimeToUtc(
    dateKey,
    '09:00',
    timezone,
  )

  if (
    dueAt &&
    isInsideDispatchWindow(dueAt, now)
  ) {
    candidates.push({
      familyId,
      category,
      referenceId,
      dedupeKey:
        `${category}-today:${referenceId}:${dateKey}`,
      sendAt: dueAt,
      navigateTo,
      privateTitle:
        category === 'vaccine'
          ? 'Vacuna para revisar hoy'
          : 'Vencimiento para revisar hoy',
      privateBody,
      detailedTitle:
        category === 'vaccine'
          ? `Vacuna hoy · ${detailedTitle}`
          : `Vence hoy · ${detailedTitle}`,
      detailedBody,
    })
  }

  return candidates
}

function subscriptionAllowsCandidate(
  subscription: PushSubscriptionRow,
  candidate: Candidate,
  member?: MemberRow,
) {
  const medicationOnly =
    member?.member_role !== 'owner' &&
    member?.access_level === 'medication_only'

  if (
    medicationOnly &&
    !candidate.category.startsWith('medication_')
  ) {
    return false
  }

  switch (candidate.category) {
    case 'medication_due':
    case 'medication_postponed':
      return subscription.notify_medication_due

    case 'medication_overdue':
      return subscription.notify_medication_overdue

    case 'vaccine':
      return subscription.notify_vaccines

    case 'expiration':
      return subscription.notify_expirations

    case 'stock_low':
      return subscription.notify_stock

    case 'followup':
      return subscription.notify_followups

    default:
      return false
  }
}

async function sendWebPush(
  subscription: PushSubscriptionRow,
  candidate: Candidate,
) {
  const title = subscription.show_details
    ? candidate.detailedTitle
    : candidate.privateTitle

  const body = subscription.show_details
    ? candidate.detailedBody
    : candidate.privateBody

  const payload = JSON.stringify({
    title,
    body,
    url: candidate.navigateTo,
    tag: candidate.dedupeKey,
    category: candidate.category,
    referenceId: candidate.referenceId,
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon-32x32.png',
  })

  return webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh_key,
        auth: subscription.auth_key,
      },
    },
    payload,
    {
      TTL: 60 * 60,
      urgency: 'high',
    },
  )
}

async function sendTestNotification(
  request: Request,
  subscriptionId: string,
) {
  assertServerConfiguration()

  if (!SUPABASE_ANON_KEY) {
    return jsonResponse(
      {
        ok: false,
        message:
          'Falta SUPABASE_ANON_KEY en la Edge Function.',
      },
      500,
    )
  }

  const authorization =
    request.headers.get('Authorization') || ''

  if (!authorization) {
    return jsonResponse(
      {
        ok: false,
        message: 'La sesión no es válida.',
      },
      401,
    )
  }

  const userClient = createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
    },
  )

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return jsonResponse(
      {
        ok: false,
        message: 'La sesión terminó.',
      },
      401,
    )
  }

  const admin = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  )

  const { data: subscription, error } =
    await admin
      .from('push_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('user_id', user.id)
      .eq('is_enabled', true)
      .maybeSingle()

  if (error || !subscription) {
    return jsonResponse(
      {
        ok: false,
        message:
          'No se encontró el dispositivo registrado.',
      },
      404,
    )
  }

  try {
    await sendWebPush(
      subscription as PushSubscriptionRow,
      {
        familyId: subscription.family_id,
        category: 'medication_due',
        referenceId: 'test',
        dedupeKey: `test:${Date.now()}`,
        sendAt: new Date(),
        navigateTo: '/dashboard/reminders',
        privateTitle: 'MiPeque está listo',
        privateBody:
          'Las notificaciones push funcionan en este dispositivo.',
        detailedTitle: 'MiPeque está listo',
        detailedBody:
          'Las notificaciones push funcionan en este dispositivo.',
      },
    )

    return jsonResponse({
      ok: true,
      message: 'Notificación de prueba enviada.',
    })
  } catch (pushError) {
    const statusCode = Number(
      (pushError as { statusCode?: number })
        ?.statusCode || 0,
    )

    if ([404, 410].includes(statusCode)) {
      await admin
        .from('push_subscriptions')
        .update({ is_enabled: false })
        .eq('id', subscription.id)
    }

    console.error(
      'Error enviando push de prueba:',
      pushError,
    )

    return jsonResponse(
      {
        ok: false,
        message:
          'El servicio push rechazó la notificación. Volvé a activar las notificaciones en el dispositivo.',
      },
      502,
    )
  }
}

async function dispatchNotifications(request: Request) {
  assertServerConfiguration()

  const suppliedSecret =
    request.headers.get(
      'x-mipeque-cron-secret',
    ) || ''

  const admin = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  )

  const {
    data: cronAuthorized,
    error: cronAuthError,
  } = await admin.rpc(
    'is_valid_push_cron_secret',
    {
      p_secret: suppliedSecret,
    },
  )

  if (
    cronAuthError ||
    cronAuthorized !== true
  ) {
    return jsonResponse(
      {
        ok: false,
        message: 'No autorizado.',
      },
      401,
    )
  }

  webpush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY,
  )

  const { data: subscriptions, error: subscriptionsError } =
    await admin
      .from('push_subscriptions')
      .select('*')
      .eq('is_enabled', true)

  if (subscriptionsError) {
    throw subscriptionsError
  }

  let enabledSubscriptions =
    (subscriptions || []) as PushSubscriptionRow[]

  if (enabledSubscriptions.length === 0) {
    return jsonResponse({
      ok: true,
      sent: 0,
      skipped: 0,
      message: 'No hay dispositivos habilitados.',
    })
  }

  let familyIds = [
    ...new Set(
      enabledSubscriptions.map(
        (subscription) => subscription.family_id,
      ),
    ),
  ]

  const {
    data: familyAccessRows,
    error: familyAccessError,
  } = await admin
    .from('families')
    .select(
      'id, access_status, trial_ends_at, current_period_end',
    )
    .in('id', familyIds)

  if (familyAccessError) {
    throw familyAccessError
  }

  const accessCheckTime = Date.now()

  const activeFamilyIds = new Set(
    (familyAccessRows || [])
      .filter((family) => {
        if (
          family.access_status === 'trial'
        ) {
          return (
            new Date(
              family.trial_ends_at || 0,
            ).getTime() >
            accessCheckTime
          )
        }

        if (
          family.access_status === 'active'
        ) {
          return (
            new Date(
              family.current_period_end || 0,
            ).getTime() >
            accessCheckTime
          )
        }

        return false
      })
      .map((family) => family.id),
  )

  enabledSubscriptions =
    enabledSubscriptions.filter(
      (subscription) =>
        activeFamilyIds.has(
          subscription.family_id,
        ),
    )

  if (enabledSubscriptions.length === 0) {
    return jsonResponse({
      ok: true,
      sent: 0,
      skipped: 0,
      message:
        'No hay dispositivos de familias con acceso activo.',
    })
  }

  familyIds = [
    ...new Set(
      enabledSubscriptions.map(
        (subscription) => subscription.family_id,
      ),
    ),
  ]

  const userIds = [
    ...new Set(
      enabledSubscriptions.map(
        (subscription) => subscription.user_id,
      ),
    ),
  ]

  const [
    settingsResult,
    membersResult,
    childrenResult,
    treatmentsResult,
    reminderRecordsResult,
    vaccinesResult,
    cabinetResult,
    consultationsResult,
    deliveriesResult,
  ] = await Promise.all([
    admin
      .from('family_settings')
      .select(
        'family_id, reminder_advance_minutes, expiration_warning_days, vaccine_warning_days, show_overdue_alerts, show_stock_alerts, show_expiration_alerts, show_vaccine_alerts',
      )
      .in('family_id', familyIds),

    admin
      .from('family_members')
      .select(
        'family_id, user_id, member_role, status, access_level',
      )
      .in('family_id', familyIds)
      .in('user_id', userIds)
      .eq('status', 'active'),

    admin
      .from('children')
      .select('id, family_id, full_name')
      .in('family_id', familyIds),

    admin
      .from('treatments')
      .select(
        'id, family_id, child_id, medication_name, presentation, dosage_instruction, start_date, end_date, frequency_mode, interval_hours, first_dose_time, custom_times, status',
      )
      .in('family_id', familyIds)
      .in('status', ['active', 'scheduled']),

    admin
      .from('reminder_records')
      .select(
        'id, family_id, treatment_id, child_id, status, scheduled_at, postponed_until, medication_name, dosage_instruction, child_name',
      )
      .in('family_id', familyIds)
      .gte(
        'scheduled_at',
        new Date(
          Date.now() - 30 * 24 * 60 * 60 * 1000,
        ).toISOString(),
      ),

    admin
      .from('vaccines')
      .select(
        'id, family_id, child_id, vaccine_name, dose_label, next_dose_date',
      )
      .in('family_id', familyIds)
      .not('next_dose_date', 'is', null),

    admin
      .from('medicine_cabinet_items')
      .select(
        'id, family_id, child_id, medicine_name, current_stock, minimum_stock, stock_unit, expiration_date',
      )
      .in('family_id', familyIds),

    admin
      .from('consultations')
      .select(
        'id, family_id, child_id, reason, follow_up_date',
      )
      .in('family_id', familyIds)
      .not('follow_up_date', 'is', null),

    admin
      .from('push_notification_deliveries')
      .select('subscription_id, dedupe_key')
      .in(
        'subscription_id',
        enabledSubscriptions.map(
          (subscription) => subscription.id,
        ),
      ),
  ])

  const errors = [
    settingsResult.error,
    membersResult.error,
    childrenResult.error,
    treatmentsResult.error,
    reminderRecordsResult.error,
    vaccinesResult.error,
    cabinetResult.error,
    consultationsResult.error,
    deliveriesResult.error,
  ].filter(Boolean)

  if (errors.length > 0) {
    throw errors[0]
  }

  const settingsByFamily = new Map(
    ((settingsResult.data || []) as FamilySettingsRow[]).map(
      (settings) => [settings.family_id, settings],
    ),
  )

  const membersByUserFamily = new Map(
    ((membersResult.data || []) as MemberRow[]).map(
      (member) => [
        `${member.user_id}:${member.family_id}`,
        member,
      ],
    ),
  )

  const children =
    (childrenResult.data || []) as ChildRow[]

  const childrenById = new Map(
    children.map((child) => [child.id, child]),
  )

  const reminderRecords =
    (reminderRecordsResult.data || []) as ReminderRecordRow[]

  const reminderRecordById = new Map(
    reminderRecords.map((record) => [record.id, record]),
  )

  const familyTimezone = new Map<string, string>()

  enabledSubscriptions.forEach((subscription) => {
    if (!familyTimezone.has(subscription.family_id)) {
      familyTimezone.set(
        subscription.family_id,
        subscription.timezone || DEFAULT_TIMEZONE,
      )
    }
  })

  const now = new Date()
  const candidates: Candidate[] = []

  for (const treatment of
    (treatmentsResult.data || []) as TreatmentRow[]) {
    const settings =
      settingsByFamily.get(treatment.family_id)

    if (!settings) {
      continue
    }

    const timezone =
      familyTimezone.get(treatment.family_id) ||
      DEFAULT_TIMEZONE

    const medicationCandidates =
      createMedicationCandidates({
        treatment,
        child: childrenById.get(treatment.child_id),
        settings,
        timezone,
        now,
      })

    for (const candidate of medicationCandidates) {
      const savedRecord =
        reminderRecordById.get(candidate.referenceId)

      if (
        savedRecord &&
        ['administered', 'omitted', 'postponed'].includes(
          savedRecord.status,
        )
      ) {
        continue
      }

      candidates.push(candidate)
    }
  }

  for (const record of reminderRecords) {
    if (
      record.status !== 'postponed' ||
      !record.postponed_until
    ) {
      continue
    }

    const postponedAt = new Date(
      record.postponed_until,
    )

    if (
      Number.isNaN(postponedAt.getTime()) ||
      !isInsideDispatchWindow(postponedAt, now)
    ) {
      continue
    }

    candidates.push({
      familyId: record.family_id,
      category: 'medication_postponed',
      referenceId: record.id,
      dedupeKey:
        `med-postponed:${record.id}:${record.postponed_until}`,
      sendAt: postponedAt,
      navigateTo: '/dashboard/reminders',
      privateTitle: 'Recordatorio pospuesto',
      privateBody:
        'Llegó la hora del recordatorio que habías pospuesto.',
      detailedTitle:
        `Recordatorio · ${record.medication_name || 'medicación'}`,
      detailedBody:
        `${record.child_name || 'MiPeque'} · ${record.dosage_instruction || 'Revisá la toma'}`,
    })
  }

  for (const vaccine of
    (vaccinesResult.data || []) as VaccineRow[]) {
    if (!vaccine.next_dose_date) {
      continue
    }

    const settings =
      settingsByFamily.get(vaccine.family_id)

    if (!settings?.show_vaccine_alerts) {
      continue
    }

    const timezone =
      familyTimezone.get(vaccine.family_id) ||
      DEFAULT_TIMEZONE

    const childName =
      childrenById.get(vaccine.child_id)?.full_name ||
      'uno de tus hijos'

    candidates.push(
      ...createDateNotificationCandidates({
        familyId: vaccine.family_id,
        referenceId: vaccine.id,
        dateKey: vaccine.next_dose_date,
        warningDays:
          settings.vaccine_warning_days,
        timezone,
        now,
        category: 'vaccine',
        navigateTo: '/dashboard/vaccines',
        privateTitle: 'Próxima vacuna',
        privateBody:
          'Hay una fecha de vacunación próxima registrada en MiPeque.',
        detailedTitle: vaccine.vaccine_name,
        detailedBody:
          `${childName}${vaccine.dose_label ? ` · ${vaccine.dose_label}` : ''} · ${vaccine.next_dose_date}`,
      }),
    )
  }

  const cabinetRows =
    (cabinetResult.data || []) as CabinetRow[]

  const healthyStockReferenceIds = cabinetRows
    .filter(
      (item) =>
        Number(item.current_stock) >
        Number(item.minimum_stock),
    )
    .map((item) => item.id)

  if (healthyStockReferenceIds.length > 0) {
    for (
      let index = 0;
      index < healthyStockReferenceIds.length;
      index += 100
    ) {
      await admin
        .from('push_notification_deliveries')
        .delete()
        .eq('category', 'stock_low')
        .in(
          'reference_id',
          healthyStockReferenceIds.slice(index, index + 100),
        )
    }
  }

  for (const item of cabinetRows) {
    const settings =
      settingsByFamily.get(item.family_id)

    const timezone =
      familyTimezone.get(item.family_id) ||
      DEFAULT_TIMEZONE

    const childName =
      childrenById.get(item.child_id)?.full_name ||
      'uno de tus hijos'

    if (
      settings?.show_stock_alerts &&
      Number(item.current_stock) <=
        Number(item.minimum_stock)
    ) {
      candidates.push({
        familyId: item.family_id,
        category: 'stock_low',
        referenceId: item.id,
        dedupeKey: `stock-low:${item.id}`,
        sendAt: now,
        navigateTo: '/dashboard/medicine-cabinet',
        privateTitle: 'Poco stock en el botiquín',
        privateBody:
          'Hay un medicamento con poco stock o agotado.',
        detailedTitle: `Poco stock · ${item.medicine_name}`,
        detailedBody:
          `${childName} · quedan ${item.current_stock} ${item.stock_unit || 'unidades'}`,
      })
    }

    if (
      settings?.show_expiration_alerts &&
      item.expiration_date
    ) {
      candidates.push(
        ...createDateNotificationCandidates({
          familyId: item.family_id,
          referenceId: item.id,
          dateKey: item.expiration_date,
          warningDays:
            settings.expiration_warning_days,
          timezone,
          now,
          category: 'expiration',
          navigateTo: '/dashboard/medicine-cabinet',
          privateTitle: 'Medicamento próximo a vencer',
          privateBody:
            'Hay un vencimiento próximo para revisar en el botiquín.',
          detailedTitle: item.medicine_name,
          detailedBody:
            `${childName} · vence el ${item.expiration_date}`,
        }),
      )
    }
  }

  for (const consultation of
    (consultationsResult.data || []) as ConsultationRow[]) {
    if (!consultation.follow_up_date) {
      continue
    }

    const timezone =
      familyTimezone.get(consultation.family_id) ||
      DEFAULT_TIMEZONE

    const childName =
      childrenById.get(consultation.child_id)?.full_name ||
      'uno de tus hijos'

    const dayBefore = addDaysToDateKey(
      consultation.follow_up_date,
      -1,
    )

    const warningAt = zonedDateTimeToUtc(
      dayBefore,
      '09:00',
      timezone,
    )

    if (
      warningAt &&
      isInsideDispatchWindow(warningAt, now)
    ) {
      candidates.push({
        familyId: consultation.family_id,
        category: 'followup',
        referenceId: consultation.id,
        dedupeKey:
          `followup-warning:${consultation.id}:${consultation.follow_up_date}`,
        sendAt: warningAt,
        navigateTo: '/dashboard/consultations',
        privateTitle: 'Seguimiento médico mañana',
        privateBody:
          'Tenés una fecha de seguimiento registrada para mañana.',
        detailedTitle: `Seguimiento de ${childName}`,
        detailedBody:
          `${consultation.reason || 'Consulta médica'} · ${consultation.follow_up_date}`,
      })
    }

    const dueAt = zonedDateTimeToUtc(
      consultation.follow_up_date,
      '09:00',
      timezone,
    )

    if (
      dueAt &&
      isInsideDispatchWindow(dueAt, now)
    ) {
      candidates.push({
        familyId: consultation.family_id,
        category: 'followup',
        referenceId: consultation.id,
        dedupeKey:
          `followup-today:${consultation.id}:${consultation.follow_up_date}`,
        sendAt: dueAt,
        navigateTo: '/dashboard/consultations',
        privateTitle: 'Seguimiento médico hoy',
        privateBody:
          'Tenés una fecha de seguimiento registrada para hoy.',
        detailedTitle: `Seguimiento de ${childName}`,
        detailedBody:
          consultation.reason || 'Consulta médica',
      })
    }
  }

  const existingDeliveries = new Set(
    ((deliveriesResult.data || []) as DeliveryRow[]).map(
      (delivery) =>
        `${delivery.subscription_id}|${delivery.dedupe_key}`,
    ),
  )

  let sent = 0
  let skipped = 0
  let failed = 0

  for (const subscription of enabledSubscriptions) {
    const member = membersByUserFamily.get(
      `${subscription.user_id}:${subscription.family_id}`,
    )

    if (!member) {
      skipped += 1
      continue
    }

    const familyCandidates = candidates.filter(
      (candidate) =>
        candidate.familyId === subscription.family_id,
    )

    for (const candidate of familyCandidates) {
      if (
        !subscriptionAllowsCandidate(
          subscription,
          candidate,
          member,
        )
      ) {
        skipped += 1
        continue
      }

      const deliveryKey =
        `${subscription.id}|${candidate.dedupeKey}`

      if (existingDeliveries.has(deliveryKey)) {
        skipped += 1
        continue
      }

      try {
        await sendWebPush(subscription, candidate)

        const { error: deliveryError } = await admin
          .from('push_notification_deliveries')
          .insert({
            subscription_id: subscription.id,
            family_id: subscription.family_id,
            user_id: subscription.user_id,
            category: candidate.category,
            reference_id: candidate.referenceId,
            dedupe_key: candidate.dedupeKey,
            sent_at: new Date().toISOString(),
          })

        if (
          deliveryError &&
          deliveryError.code !== '23505'
        ) {
          console.error(
            'No se pudo registrar la entrega push:',
            deliveryError,
          )
        }

        existingDeliveries.add(deliveryKey)
        sent += 1
      } catch (pushError) {
        failed += 1

        const statusCode = Number(
          (pushError as { statusCode?: number })
            ?.statusCode || 0,
        )

        if ([404, 410].includes(statusCode)) {
          await admin
            .from('push_subscriptions')
            .update({ is_enabled: false })
            .eq('id', subscription.id)
        }

        console.error(
          `No se pudo enviar ${candidate.category} a ${subscription.id}:`,
          pushError,
        )
      }
    }
  }

  return jsonResponse({
    ok: true,
    sent,
    skipped,
    failed,
    candidates: candidates.length,
    checkedSubscriptions:
      enabledSubscriptions.length,
  })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    })
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      {
        ok: false,
        message: 'Método no permitido.',
      },
      405,
    )
  }

  try {
    const body = await request.json().catch(() => ({}))

    if (body?.mode === 'test') {
      const subscriptionId = String(
        body.subscriptionId || '',
      )

      if (!subscriptionId) {
        return jsonResponse(
          {
            ok: false,
            message:
              'Falta indicar el dispositivo de prueba.',
          },
          400,
        )
      }

      webpush.setVapidDetails(
        VAPID_SUBJECT,
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY,
      )

      return await sendTestNotification(
        request,
        subscriptionId,
      )
    }

    return await dispatchNotifications(request)
  } catch (error) {
    console.error('Push notifications error:', error)

    return jsonResponse(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : 'Ocurrió un error enviando las notificaciones.',
      },
      500,
    )
  }
})
