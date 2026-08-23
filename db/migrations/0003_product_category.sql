-- -----------------------------------------------------------------------------
--  0003 · Categoría de producto
--
--  El catálogo se recorría entero: en un teléfono son casi ocho pantallas de
--  scroll y no había forma de filtrar. La categoría es lo mínimo que permite
--  una fila de filtros arriba de la grilla.
--
--  Se agrega con default para que los productos existentes sigan siendo válidos
--  sin una migración de datos: el UPDATE de abajo los reubica.
-- -----------------------------------------------------------------------------
alter table public.products
  add column if not exists category text not null default 'accesorios';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'products_category_check'
  ) then
    alter table public.products
      add constraint products_category_check
      check (category in ('abrigo', 'pantalones', 'remeras', 'accesorios'));
  end if;
end $$;

create index if not exists products_category_idx on public.products (category);

-- Reubica el catálogo actual. Los que no matchean quedan en accesorios, que es
-- exactamente donde van medias, cuello y toalla.
update public.products set category = 'abrigo'
  where id in ('campera-canguro', 'buzo-canguro', 'buzo-medio-cierre');

update public.products set category = 'pantalones'
  where id like 'pantalon%';

update public.products set category = 'remeras'
  where id like 'remera%' or id like 'musculosa%';
