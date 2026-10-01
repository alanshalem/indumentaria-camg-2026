-- -----------------------------------------------------------------------------
--  0007 · Método de pago, link de cobro y registro de WhatsApp
--
--  · `payment_method` lo registra el club, no el socio: el flujo real es que el
--    pedido se genera y después alguien lo contacta para cobrarlo. Nullable
--    porque "todavía no se sabe" es un estado legítimo, distinto de efectivo.
--
--  · `payment_link` es el link de cobro de Mercado Pago, pegado a mano. Va por
--    pedido y no en la config del club porque lleva el monto de ese pedido.
--
--  · `whatsapp_log` guarda qué plantilla se le preparó a cada socio. Se llama
--    `prepared_at` y no `sent_at` a propósito: no hay API de WhatsApp de por
--    medio, se abre el chat con el texto escrito y el envío lo aprieta una
--    persona. Decir "enviado" sería afirmar algo que el sistema no sabe.
-- -----------------------------------------------------------------------------
alter table public.orders
  add column if not exists payment_method text,
  add column if not exists payment_link   text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_payment_method_check') then
    alter table public.orders
      add constraint orders_payment_method_check
      check (payment_method is null or payment_method in ('cash', 'mercadopago'));
  end if;
end $$;

create index if not exists orders_payment_method_idx on public.orders (payment_method);

create table if not exists public.whatsapp_log (
  id          bigint generated always as identity primary key,
  order_code  text        not null references public.orders(code) on delete cascade,
  template    text        not null check (template in ('paymentLink', 'cash')),
  prepared_at timestamptz not null default now()
);

create index if not exists whatsapp_log_order_idx
  on public.whatsapp_log (order_code, prepared_at desc);

alter table public.whatsapp_log enable row level security;
revoke all on public.whatsapp_log from anon, authenticated;
