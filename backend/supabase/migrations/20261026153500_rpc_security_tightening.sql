-- =========================================================
-- MiPeque - ajuste de permisos RPC
-- 2026-10-26
-- =========================================================
--
-- Las funciones siguientes requieren una sesión autenticada.
-- Se mantiene el acceso authenticated y se elimina anon.

revoke execute
on function public.register_push_subscription(
  uuid, text, text, text, text, text,
  boolean, boolean, boolean, boolean,
  boolean, boolean, boolean
)
from anon;

revoke execute
on function public.detach_push_subscription(text)
from anon;

revoke execute
on function public.get_family_child_capacity(uuid)
from anon;

revoke execute
on function public.set_family_children_limit(uuid, integer)
from anon;

revoke execute
on function public.update_child_limit_settings(integer, integer)
from anon;
