-- =============================================================================
--  CAMG · Catálogo y promociones
--  Fuente: public/Manual de Trabajo.md — Lista de precios Agosto 2026.
--  Los talles salen de las tablas oficiales en public/images/tablas-talles:
--  la línea divisoria de esas tablas (después del 14) es el corte de precio
--  entre "talles chicos" y "talles grandes".
--  Idempotente: reejecutar actualiza precios y talles sin duplicar filas.
-- =============================================================================

insert into public.products
  (id, name, description, image_url, sizes_small, sizes_large, price_small, price_large, colors, size_chart_id, is_active, sort_order)
values
  ('campera-canguro',
   'Campera Canguro CAMG',
   'Campera con capucha y cierre completo, diseño sublimado rojo y negro del club.',
   '/images/fotos-prendas/campera.jpg',
   array['6','8','10','12','14'],
   array['16/XS','S','M','L','XL','XXL','3XL'],
   48500, 54000, '[]'::jsonb, 'buzos', true, 10),

  ('buzo-canguro',
   'Buzo Canguro CAMG',
   'Buzo canguro con capucha y bolsillo delantero.',
   '/images/fotos-prendas/buzo-canguro.jpg',
   array['6','8','10','12','14'],
   array['16/XS','S','M','L','XL','XXL','3XL'],
   46000, 51500, '[]'::jsonb, 'buzos', true, 20),

  ('buzo-medio-cierre',
   'Buzo Medio Cierre CAMG',
   'Buzo de entrenamiento con medio cierre y detalles sublimados en las mangas.',
   '/images/fotos-prendas/buzo-medio-cierre.jpg',
   array['6','8','10','12','14'],
   array['16/XS','S','M','L','XL','XXL','3XL'],
   41000, 45500, '[]'::jsonb, 'buzos', true, 30),

  ('pantalon-con-cierre',
   'Pantalón con cierre CAMG',
   'Pantalón largo de entrenamiento con cierre en los bolsillos.',
   '/images/fotos-prendas/pantalon.jpg',
   array['6','8','10','12','14'],
   array['XS','S','M','L','XL','2XL','3XL'],
   44000, 48500, '[]'::jsonb, 'pantalones', true, 40),

  ('remera-algodon',
   'Remera de algodón CAMG',
   'Remera unisex 100% algodón. Disponible en blanca, negra y roja.',
   '/images/fotos-prendas/remera-blanca-algodon.jpg',
   array['8','10','12','14'],
   array['XS','S','M','L','XL','XXL'],
   20500, 23000,
   '[{"name":"Blanca","hex":"#F5F5F5","imageUrl":"/images/fotos-prendas/remera-blanca-algodon.jpg"},
     {"name":"Negra","hex":"#1A1A1A","imageUrl":"/images/fotos-prendas/remera-negra-algodon.jpg"},
     {"name":"Roja","hex":"#DC143C","imageUrl":"/images/fotos-prendas/remera-roja-algodon.jpg"}]'::jsonb,
   'remeras', true, 50),

  ('medias-camg',
   'Medias CAMG',
   'Medias deportivas con CAMG bordado. Disponibles en negras y blancas.',
   '/images/fotos-prendas/medias-negras-blancas.jpg',
   array['38-42'],
   array['42-50'],
   6000, 6500,
   '[{"name":"Negras","hex":"#1A1A1A","imageUrl":null},
     {"name":"Blancas","hex":"#F5F5F5","imageUrl":null}]'::jsonb,
   null, true, 60),

  ('cuello-camg',
   'Cuello CAMG',
   'Cuello deportivo con el escudo del club. Talle único.',
   '/images/fotos-prendas/cuello.png',
   array[]::text[],
   array['Único'],
   2000, 2000, '[]'::jsonb, null, true, 70),

  ('toalla-camg',
   'Toalla de mano CAMG',
   'Toalla de mano con el escudo del club. Talle único.',
   '/images/fotos-prendas/toalla.png',
   array[]::text[],
   array['Único'],
   1000, 1000, '[]'::jsonb, null, true, 80)

on conflict (id) do update set
  name          = excluded.name,
  description   = excluded.description,
  image_url     = excluded.image_url,
  sizes_small   = excluded.sizes_small,
  sizes_large   = excluded.sizes_large,
  price_small   = excluded.price_small,
  price_large   = excluded.price_large,
  colors        = excluded.colors,
  size_chart_id = excluded.size_chart_id,
  sort_order    = excluded.sort_order;

-- -----------------------------------------------------------------------------
--  Promociones
--  `is_active` NO se pisa al reejecutar: si el club apagó una promo desde el
--  panel, un reseed no tiene por qué volver a encenderla.
-- -----------------------------------------------------------------------------
insert into public.promotions (id, kind, label, description, config, is_active, sort_order)
values
  ('combo-buzo-pantalon',
   'combo',
   'Combo buzo ½ cierre + pantalón',
   'Llevando un buzo medio cierre y un pantalón juntos, pagás el precio del combo.',
   '{"productIds":["buzo-medio-cierre","pantalon-con-cierre"],
     "bundlePriceLarge":85000,
     "bundlePriceSmall":75000}'::jsonb,
   true, 10),

  ('familia-camg',
   'sameProductDifferentSize',
   'Promo familia CAMG',
   'Con la compra de 2 productos iguales de distinto talle, 10% de descuento en el más barato.',
   '{"percentOff":10}'::jsonb,
   true, 20)

on conflict (id) do update set
  kind        = excluded.kind,
  label       = excluded.label,
  description = excluded.description,
  config      = excluded.config,
  sort_order  = excluded.sort_order;
