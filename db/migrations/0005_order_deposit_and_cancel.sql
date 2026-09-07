-- -----------------------------------------------------------------------------
--  0005 · Seña recibida + pedido eliminado
--
--  Dos estados nuevos, por motivos distintos:
--
--   · `deposit` (Seña recibida) es una etapa más del circuito, entre "pendiente
--     de pago" y "pago confirmado". Hay socios que señan y no completan el pago;
--     sin esta etapa quedaban mezclados con los que no pagaron nada.
--
--   · `cancelled` (Eliminado) NO es una etapa: es salir del circuito. Eliminar
--     un pedido no borra la fila. Borrarla se llevaría por delante el historial
--     de mails (email_log referencia orders con ON DELETE CASCADE) y dejaría el
--     link de seguimiento que el socio tiene en su casilla apuntando a un 404.
--     Como estado, la página puede decirle que el club lo dio de baja, y el
--     club puede restaurarlo si fue un error.
-- -----------------------------------------------------------------------------
alter table public.orders drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'deposit', 'paid', 'ready', 'delivered', 'cancelled'));

-- Filtrar por estado es lo que más hace el panel, y ahora además excluye los
-- eliminados en cada listado.
create index if not exists orders_status_idx on public.orders (status);

-- El aviso de la seña es un tipo de mail más para la idempotencia: el socio lo
-- recibe una sola vez aunque el admin mueva el estado de ida y vuelta.
alter table public.email_log drop constraint if exists email_log_kind_check;

alter table public.email_log
  add constraint email_log_kind_check
  check (kind in ('orderReceived', 'depositReceived', 'paymentConfirmed', 'readyForPickup'));
