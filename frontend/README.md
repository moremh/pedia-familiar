# MiPeque Frontend

Aplicación React/Vite de MiPeque.

## Requisitos

- Node.js 20 o superior.
- Proyecto Supabase con las migraciones del repositorio aplicadas.

## Configuración

```bash
cp .env.example .env.local
```

Variables:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_tu_clave_publica
VITE_ADMIN_WHATSAPP=549381XXXXXXXX
VITE_VAPID_PUBLIC_KEY=TU_CLAVE_PUBLICA_VAPID
```

La clave VAPID del frontend es pública. La clave VAPID privada y `PUSH_CRON_SECRET` deben existir únicamente como secretos de Supabase.

## Desarrollo

```bash
npm install
npm run dev
```

## Calidad

```bash
npm run lint
npm test
npm run build
npm run preview
```

Las páginas se cargan de forma diferida con `React.lazy` para reducir el bundle inicial.

## PWA y notificaciones

El service worker está en `public/sw.js`.

Flujo de activación:

1. Abrir MiPeque desde HTTPS.
2. Ir a Configuración → Notificaciones push.
3. Activar el dispositivo.
4. Aceptar el permiso del navegador.
5. Enviar una notificación de prueba.

En iPhone/iPad, MiPeque debe instalarse en la pantalla de inicio antes de activar Web Push.

## Recuperación de contraseña

La ruta pública es:

```text
/reset-password
```

Supabase Auth debe tener esa URL permitida como Redirect URL.

## Centro de ayuda

El manual de usuario se encuentra en:

```text
/dashboard/help
```

Está disponible tanto para responsables con acceso completo como para responsables con acceso limitado a tomas.
