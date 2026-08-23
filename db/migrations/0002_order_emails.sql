-- =============================================================================
--  CAMG · Estados de pedido y registro de mails
--  Idempotente: se puede volver a correr sin romper nada.
-- =============================================================================

-- -----------------------------------------------------------------------------
--  El pedido pasa a tener cuatro estados en vez de dos.
--  El anterior (pendiente/entregado) juntaba tres momentos distintos —esperando
--  el pago, esperando la prenda, ya retirada— en uno solo.
-- -----------------------------------------------------------------------------
alter table public.orders drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in ('pending', 'paid', 'ready', 'delivered'));

-- -----------------------------------------------------------------------------
--  email_log
--  Registra cada intento de envío. Cumple tres funciones:
--   1. Idempotencia: el índice único de abajo impide mandarle dos veces el mismo
--      aviso al socio si el admin mueve el estado de ida y vuelta.
--   2. Auditoría: queda constancia de qué se envió y a quién.
--   3. Diagnóstico: si el proveedor falla, el error queda guardado.
-- -----------------------------------------------------------------------------
create table if not exists public.email_log (
  id          bigint generated always as identity primary key,
  order_code  text        not null references public.orders(code) on delete cascade,
  kind        text        not null
                check (kind in ('orderReceived', 'paymentConfirmed', 'readyForPickup')),
  recipient   text        not null,
  status      text        not null check (status in ('sent', 'failed', 'skipped')),
  provider_id text,
  error       text,
  created_at  timestamptz not null default now()
);

create index if not exists email_log_order_idx on public.email_log (order_code, created_at desc);

-- Un solo envío exitoso por pedido y tipo de aviso. Los intentos fallidos no
-- ocupan el lugar: se pueden reintentar.
create unique index if not exists email_log_sent_once
  on public.email_log (order_code, kind)
  where status = 'sent';

-- -----------------------------------------------------------------------------
--  RLS: mismo criterio que el resto. Sin policies, sólo entra la API con
--  service_role. La tabla guarda direcciones de mail de socios.
-- -----------------------------------------------------------------------------
alter table public.email_log enable row level security;
revoke all on public.email_log from anon, authenticated;
