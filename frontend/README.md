# MiPeque

MiPeque es una aplicación web familiar para organizar información de salud infantil: hijos, consultas, tratamientos, recordatorios, vacunas, documentos médicos, botiquín y responsables.

## Tecnologías

- React + Vite
- React Router
- Supabase Auth, Database y Storage
- Bootstrap y Bootstrap Icons
- PWA instalable

## Requisitos

- Node.js 20 o superior
- Un proyecto de Supabase con las migraciones de MiPeque aplicadas

## Configuración

1. Copiá `.env.example` como `.env.local`.
2. Completá la URL y la clave pública de Supabase.
3. No coloques una clave `secret` o `service_role` en el frontend.

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_tu_clave_publica
VITE_ADMIN_WHATSAPP=549381XXXXXXXX
```

## Desarrollo

```bash
npm install
npm run dev
```

## Comprobación de producción

```bash
npm run build
npm run preview
```

## Crear la cuenta administradora

1. En Supabase abrí `Authentication → Users → Add user` y creá la cuenta administrativa. Marcala como confirmada.
2. En el SQL Editor del proyecto ejecutá:

```sql
select public.set_user_admin(
  'tu-correo@ejemplo.com',
  true
);
```

3. Cerrá la sesión e ingresá nuevamente. La cuenta será dirigida al panel administrador.

Para quitar el rol administrador:

```sql
select public.set_user_admin(
  'tu-correo@ejemplo.com',
  false
);
```

## Datos y seguridad

Las tablas están protegidas con políticas RLS. Los documentos se guardan en el bucket privado `medical-files`. El frontend utiliza únicamente la clave pública del proyecto.

Los archivos `.env`, `.env.local`, `node_modules` y `dist` no deben subirse al repositorio.
