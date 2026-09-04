-- -----------------------------------------------------------------------------
--  0004 · Promos: alcance por producto y corrección del combo
--
--  Dos cambios que pidió el club:
--
--   1. El combo era "buzo medio cierre + pantalón" y en realidad es
--      "campera + pantalón". Se renombra el id para que deje de mentir; los
--      pedidos viejos no se tocan porque guardan la promo aplicada como
--      snapshot (label, detalle e importe), no como referencia a esta tabla.
--
--   2. "Promo familia" aplicaba a todo el catálogo. Sólo va en indumentaria:
--      campera, buzo canguro, buzo medio cierre, pantalón y remera. Nunca en
--      toalla, cuello, medias ni musculosa.
--
--  El precio del combo mantiene el ahorro del combo anterior (−$9.000 en
--  grandes, −$10.000 en chicos). Es un supuesto: el club lo ajusta desde el
--  panel de promociones sin necesidad de otra migración.
-- -----------------------------------------------------------------------------

update public.promotions
   set id          = 'combo-campera-pantalon',
       label       = 'Combo campera + pantalón',
       description = 'Llevando una campera y un pantalón juntos, pagás el precio del combo.',
       config      = jsonb_build_object(
                       'productIds',       jsonb_build_array('campera-canguro', 'pantalon-con-cierre'),
                       'bundlePriceLarge', 93500,
                       'bundlePriceSmall', 82500
                     ),
       updated_at  = now()
 where id = 'combo-buzo-pantalon';

-- `productIds` se agrega sólo si falta: reejecutar la migración no pisa una
-- lista que el club ya haya editado desde el panel.
update public.promotions
   set config     = config || jsonb_build_object(
                      'productIds',
                      jsonb_build_array('campera-canguro', 'buzo-canguro', 'buzo-medio-cierre',
                                        'pantalon-con-cierre', 'remera-algodon')
                    ),
       updated_at = now()
 where kind = 'sameProductDifferentSize'
   and not (config ? 'productIds');
