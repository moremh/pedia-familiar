# MiPeque

MiPeque es una PWA para organizar la salud y el cuidado diario de una familia: perfiles infantiles, consultas, tratamientos, recordatorios de tomas, vacunas, botiquín, documentos médicos, responsables y alertas.

## Estructura

- `frontend/`: React + Vite + React Router + Bootstrap.
- `backend/supabase/migrations/`: esquema, RLS y funciones SQL.
- `backend/supabase/functions/`: Edge Functions.
- `backend/supabase/PUSH_CRON_SETUP.sql`: plantilla para crear el cron de notificaciones.

## Funciones principales

- Autenticación y recuperación de contraseña con Supabase Auth.
- Prueba gratuita y suscripciones familiares.
- Responsables con acceso completo o solo administración de tomas.
- Datos médicos protegidos con RLS.
- Storage privado para documentos médicos.
- PWA instalable con soporte para conexión inestable.
- Notificaciones Web Push por dispositivo.
- Copias de seguridad y restauración.
- Panel administrativo para familias, planes, promociones y cupos de hijos.
- Centro de ayuda y manual dentro de `/dashboard/help`.

## Desarrollo

```bash
cd frontend
npm install
npm run dev
```

Comprobaciones:

```bash
npm run lint
npm test
npm run build
```

## Variables del frontend

Copiá `frontend/.env.example` a `frontend/.env.local`.

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_tu_clave_publica
VITE_ADMIN_WHATSAPP=549381XXXXXXXX
VITE_VAPID_PUBLIC_KEY=TU_CLAVE_PUBLICA_VAPID
```

Nunca coloques `service_role`, claves privadas VAPID ni secretos del cron en el frontend o en Git.

## Supabase

Aplicar migraciones:

```bash
cd backend
npx supabase db push
```

Desplegar funciones:

```bash
npx supabase functions deploy push-notifications --no-verify-jwt
npx supabase functions deploy delete-account
```

Las notificaciones necesitan estos secretos en Supabase:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `PUSH_CRON_SECRET`

El archivo `PUSH_CRON_SETUP.sql` contiene únicamente placeholders. Generá un secreto nuevo antes de ejecutarlo y no lo agregues al repositorio.

## Recuperación de contraseña

En Supabase Auth, agregá como Redirect URL de producción:

```text
https://mi-peque-v1.vercel.app/reset-password
```

Agregá también la URL equivalente de desarrollo cuando pruebes localmente.

## Despliegue

Vercel debe usar `frontend` como directorio raíz del proyecto. Después de cambiar cualquier variable `VITE_*`, realizá un deployment nuevo porque Vite incorpora esas variables durante el build.

## Seguridad

- Los datos médicos y archivos privados están protegidos con RLS.
- Los responsables `medication_only` no pueden leer consultas, vacunas ni documentos médicos.
- Las push automáticas se envían solamente a familias con prueba o suscripción activa.
- Las cuentas principales no pueden eliminarse mientras existan otros responsables activos.
- Las copias de seguridad pueden contener datos sensibles y deben almacenarse de forma privada.

## CI

GitHub Actions ejecuta automáticamente lint, tests y build en cada pull request y en cada push a `main`.
