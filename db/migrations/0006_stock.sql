-- -----------------------------------------------------------------------------
--  0006 · Inventario por variante
--
--  La variante es la misma tripleta que ya identifica una línea del carrito y
--  del pedido: producto + talle + color. Para los productos sin colores es una
--  fila por talle; para la remera y las medias es la única clave que se
--  corresponde con una prenda real.
--
--  `color` es NOT NULL con default '' y no NULL: en un índice único de Postgres
--  dos NULL se consideran distintos, así que una clave con color nulo habría
--  admitido filas duplicadas para la misma variante. El dominio traduce '' ↔ null.
--
--  Una variante SIN fila no participa del inventario: no se descuenta ni avisa
--  nada. Así activar esto no puso todo el catálogo en "a pedido" de golpe.
-- -----------------------------------------------------------------------------
create table if not exists public.product_stock (
  product_id text        not null references public.products(id) on delete cascade,
  size       text        not null,
  color      text        not null default '',
  units      integer     not null default 0 check (units >= 0),
  updated_at timestamptz not null default now(),
  primary key (product_id, size, color)
);

create index if not exists product_stock_product_idx on public.product_stock (product_id);

alter table public.product_stock enable row level security;
revoke all on public.product_stock from anon, authenticated;

-- -----------------------------------------------------------------------------
--  consume_stock
--
--  Descuenta lo que haya y devuelve cuánto se pudo tomar de cada línea. Lo que
--  falta sale a pedido: el stock NUNCA bloquea una venta, sólo decide si la
--  entrega es inmediata o con plazo.
--
--  Va como función y no como una serie de UPDATE desde la app por dos motivos:
--  corre en una sola transacción, y el `for update` serializa a dos socios que
--  compran la última unidad al mismo tiempo. Con updates sueltos, los dos
--  leerían "queda 1" y el contador terminaría en -1.
-- -----------------------------------------------------------------------------
create or replace function public.consume_stock(p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item        jsonb;
  v_product   text;
  v_size      text;
  v_color     text;
  v_requested integer;
  v_available integer;
  v_taken     integer;
  resultado   jsonb := '[]'::jsonb;
begin
  for item in select * from jsonb_array_elements(p_items) loop
    v_product   := item->>'productId';
    v_size      := item->>'size';
    v_color     := coalesce(item->>'color', '');
    v_requested := greatest(0, coalesce((item->>'quantity')::integer, 0));

    v_available := null;

    select units into v_available
      from public.product_stock
     where product_id = v_product and size = v_size and color = v_color
     for update;

    if v_available is null then
      -- Variante sin stock cargado: fuera del inventario, entrega normal.
      resultado := resultado || jsonb_build_object(
        'productId', v_product,
        'size',      v_size,
        'color',     nullif(v_color, ''),
        'requested', v_requested,
        'taken',     v_requested,
        'backorder', 0,
        'tracked',   false
      );
    else
      v_taken := least(v_requested, v_available);

      if v_taken > 0 then
        update public.product_stock
           set units = units - v_taken, updated_at = now()
         where product_id = v_product and size = v_size and color = v_color;
      end if;

      resultado := resultado || jsonb_build_object(
        'productId', v_product,
        'size',      v_size,
        'color',     nullif(v_color, ''),
        'requested', v_requested,
        'taken',     v_taken,
        'backorder', v_requested - v_taken,
        'tracked',   true
      );
    end if;
  end loop;

  return resultado;
end;
$$;

-- Sólo la API, que entra con service_role. Nadie más la puede llamar.
revoke all on function public.consume_stock(jsonb) from public, anon, authenticated;
