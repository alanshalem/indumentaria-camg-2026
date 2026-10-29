-- -----------------------------------------------------------------------------
--  0008 · Restauración de stock al editar o anular pedidos
--
--  Cuando se edita un pedido y se cambian talles, colores o cantidades,
--  o se elimina un artículo, las unidades físicas que se habían descontado
--  vuelven al stock para que el inventario refleje la realidad.
-- -----------------------------------------------------------------------------
create or replace function public.restore_stock(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item      jsonb;
  v_product text;
  v_size    text;
  v_color   text;
  v_qty     integer;
begin
  for item in select * from jsonb_array_elements(p_items) loop
    v_product := item->>'productId';
    v_size    := item->>'size';
    v_color   := coalesce(item->>'color', '');
    v_qty     := greatest(0, coalesce((item->>'quantity')::integer, 0));

    if v_qty > 0 then
      update public.product_stock
         set units = units + v_qty, updated_at = now()
       where product_id = v_product and size = v_size and color = v_color;
    end if;
  end loop;
end;
$$;

revoke all on function public.restore_stock(jsonb) from public, anon, authenticated;

