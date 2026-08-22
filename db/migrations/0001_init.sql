-- =============================================================================
--  CAMG · Esquema inicial
--  Idempotente: se puede volver a correr sin romper nada.
--  Ejecutar con `npm run db:setup` o pegándolo en Supabase → SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
--  products
--  La lista de precios del club tiene dos columnas (talles grandes / talles
--  chicos), así que el precio se modela por *tier* y el talle define el tier.
-- -----------------------------------------------------------------------------
create table if not exists public.products (
  id            text primary key,
  name          text        not null check (length(btrim(name)) between 2 and 80),
  description   text        not null default '',
  image_url     text        not null,
  sizes_small   text[]      not null default '{}',
  sizes_large   text[]      not null default '{}',
  -- Pesos argentinos enteros: ARS no opera con centavos y el entero evita
  -- errores de redondeo de punto flotante.
  price_small   integer     not null check (price_small >= 0 and price_small <= 10000000),
  price_large   integer     not null check (price_large >= 0 and price_large <= 10000000),
  -- [{ "name": "Roja", "hex": "#DC143C", "imageUrl": "/images/..." }]
  colors        jsonb       not null default '[]'::jsonb,
  size_chart_id text,
  is_active     boolean     not null default true,
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Un producto sin talles no se puede comprar.
  constraint products_has_sizes
    check (cardinality(sizes_small) + cardinality(sizes_large) > 0),
  -- El mismo talle en los dos tiers haría ambiguo el precio.
  constraint products_sizes_disjoint
    check (not (sizes_small && sizes_large))
);

create index if not exists products_active_order_idx
  on public.products (is_active, sort_order, name);

-- -----------------------------------------------------------------------------
--  promotions
--  `kind` elige la estrategia de cálculo (implementada en shared/domain/
--  promotions.ts) y `config` guarda sus parámetros. Así el club puede cambiar
--  montos, porcentajes o apagar una promo sin redeployar.
-- -----------------------------------------------------------------------------
create table if not exists public.promotions (
  id          text primary key,
  kind        text        not null check (kind in ('combo', 'sameProductDifferentSize')),
  label       text        not null,
  description text        not null default '',
  config      jsonb       not null default '{}'::jsonb,
  is_active   boolean     not null default true,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists promotions_active_order_idx
  on public.promotions (is_active, sort_order);

-- -----------------------------------------------------------------------------
--  orders
--  `items` y `promotions` son snapshots inmutables: guardan nombre, precio
--  unitario y descuentos al momento de la compra, así un cambio de lista de
--  precios no reescribe la historia.
-- -----------------------------------------------------------------------------
create table if not exists public.orders (
  code               text primary key,
  customer_name      text        not null,
  customer_last_name text        not null,
  -- El club cobra contactando al socio: sin teléfono el pedido es inútil.
  phone              text        not null default '',
  email              text,
  items              jsonb       not null default '[]'::jsonb,
  subtotal           integer     not null default 0 check (subtotal >= 0),
  promotions         jsonb       not null default '[]'::jsonb,
  total              integer     not null default 0 check (total >= 0),
  status             text        not null default 'pending'
                       check (status in ('pending', 'delivered')),
  created_at         timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx     on public.orders (status);
create index if not exists orders_phone_idx      on public.orders (phone);

-- -----------------------------------------------------------------------------
--  updated_at automático
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at
  before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists promotions_touch_updated_at on public.promotions;
create trigger promotions_touch_updated_at
  before update on public.promotions
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
--  RLS: cerrado a cal y canto.
--  No se declara NINGUNA policy, así que anon y authenticated no pueden leer ni
--  escribir. El único acceso es vía la API con service_role, que sortea RLS.
--  Esto evita que la anon key del browser pueda listar los pedidos del club.
-- -----------------------------------------------------------------------------
alter table public.products   enable row level security;
alter table public.promotions enable row level security;
alter table public.orders     enable row level security;

revoke all on public.products   from anon, authenticated;
revoke all on public.promotions from anon, authenticated;
revoke all on public.orders     from anon, authenticated;

-- -----------------------------------------------------------------------------
--  Storage: bucket público para las fotos que suba el admin desde el panel.
--  La escritura pasa por la API (service_role); la lectura es pública por URL.
-- -----------------------------------------------------------------------------
-- Todo el archivo corre en una transacción: si el esquema `storage` no
-- existiera (Postgres sin Supabase), un error acá tiraría abajo también las
-- tablas. Por eso se chequea antes en vez de asumir.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'product-images',
      'product-images',
      true,
      4194304,
      array['image/png', 'image/jpeg', 'image/webp', 'image/avif']
    )
    on conflict (id) do update
      set public             = excluded.public,
          file_size_limit    = excluded.file_size_limit,
          allowed_mime_types = excluded.allowed_mime_types;
  else
    raise notice 'Esquema storage ausente: se omite el bucket product-images.';
  end if;
end $$;
