-- MiPeque - Datos iniciales opcionales
--
-- Este archivo se ejecuta después de las migraciones
-- cuando usamos:
--
-- npx supabase db reset
--
-- No agregamos familias, responsables ni hijos ficticios
-- para evitar que aparezcan datos de demostración
-- dentro de cuentas reales.
--
-- Para convertir una cuenta registrada en administradora:
--
-- 1. Registrá primero la cuenta desde MiPeque o Supabase Auth.
-- 2. Luego ejecutá en el SQL Editor:
--
select public.set_user_admin(
'tu-correo@ejemplo.com',
true
);
--
-- Para quitarle el rol administrador:
--
-- select public.set_user_admin(
--   'tu-correo@ejemplo.com',
--   false
-- );