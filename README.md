# CAMG · Indumentaria 2026

Tienda de indumentaria del Club Atlético Monte Grande: catálogo público con
precios por talle, carrito con promociones automáticas, pedidos con código de
retiro y panel administrativo para gestionar pedidos, productos y promos.

React 18 + TypeScript (strict) + Vite · API en Vercel Functions · Supabase (Postgres + Storage).

> **¿Levantando el proyecto de cero?** Seguí [DEPLOY.md](./DEPLOY.md) —
> Supabase, variables de entorno, base de datos y Vercel, paso a paso.

---

## Comandos

```bash
npm install
npm run dev         # Vite + la API montada en /api (no hace falta `vercel dev`)
npm run db:setup    # crea las tablas y carga el catálogo del manual
npm run db:check    # muestra qué hay cargado en la base
npm run images      # genera los WebP de public/images (idempotente)
npm run typecheck   # tsc strict sobre src, server, shared, api y tests
npm test            # vitest
npm run build       # typecheck + build de producción
```

---

## Modelo de negocio

Todo sale de `public/Manual de Trabajo.md` y de las tablas de talles oficiales
en `public/images/tablas-talles`.

### Precio por tramo de talle

La lista de precios tiene dos columnas por producto: **talles chicos** (6–14) y
**talles grandes** (XS–3XL). La línea divisoria de las tablas oficiales —justo
después del 14— es el corte. Por eso un producto no tiene *un* precio: tiene
`priceSmall` y `priceLarge`, y el talle elegido determina cuál se cobra.

### Promociones

Se aplican solas al armar el carrito y se recalculan en el servidor al confirmar.
La regla que ordena todo: **cada prenda participa como máximo de una promoción**,
así el ticket siempre se puede explicar en el mostrador.

| Promo | Cómo funciona |
| --- | --- |
| **Combo buzo ½ cierre + pantalón** | Cada par de esas dos prendas pasa a precio de combo. Se arman primero los pares del mismo tramo de talle, que es donde más se ahorra. Un par mixto (uno chico, uno grande) paga el precio de talles grandes. |
| **Promo familia CAMG** | Dos unidades del mismo producto en talles distintos → 10% sobre la más barata. Con 3 unidades talle M y 1 talle L hay un solo par válido, no dos. |

Los montos y porcentajes viven en la base y se editan desde el panel
(*Promos → Editar valores*), sin redeploy. Cada tipo de promo es una estrategia
tipada en `shared/domain/promotions.ts`, cubierta por tests.

### Colores

Un producto con `colors` cargados obliga a elegir uno y lo guarda en el pedido;
uno sin colores se vende sin esa elección. Hoy tienen color la remera de algodón
(blanca, negra, roja) y las medias (negras, blancas).

---

## API

Base: `/api`. Todas las respuestas usan el mismo sobre: `{ data }` en el éxito,
`{ error: { code, message, fields? } }` en el fallo.

| Método | Ruta | Acceso | Qué hace |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | público | Valida la clave y devuelve un JWT (8 h). Rate limit: 8 intentos / 5 min por IP |
| `GET` | `/auth/session` | admin | Confirma que la sesión sigue viva |
| `GET` | `/products` | público | Catálogo activo. Con `?includeInactive=true` **y** sesión admin, incluye los ocultos |
| `POST` | `/products` | **admin** | Crea un producto |
| `PATCH` | `/products/:id` | **admin** | Edita precios, talles, colores, imagen, visibilidad y orden |
| `DELETE` | `/products/:id` | **admin** | Borra un producto |
| `GET` | `/promotions` | público | Promos activas, para previsualizar el descuento en el carrito |
| `PATCH` | `/promotions/:id` | **admin** | Prende/apaga una promo o cambia sus montos |
| `POST` | `/uploads/product-image` | **admin** | Sube una imagen (base64, ≤ 4 MB) a Supabase Storage |
| `GET` | `/orders` | **admin** | Lista pedidos paginados (50 por página) con filtros de estado, texto y fechas |
| `GET` | `/orders/:code/emails` | **admin** | Historial de avisos enviados de ese pedido |
| `POST` | `/orders` | público | Checkout del socio |
| `GET` | `/orders/:code?t=…` | **firmado** | Seguimiento del pedido. Sin `t` válido devuelve 404 |
| `PATCH` | `/orders/:code` | **admin** | Cambia el estado del pedido |

Las rutas marcadas **admin** pasan por el decorator `adminOnly`, que verifica la
firma del JWT antes de ejecutar el handler.

### El link de seguimiento

El socio no tiene cuenta, pero sí una prueba de identidad: el mail. Cada aviso
lleva un botón a `/pedido/:code?t=<firma>`, donde la firma es
`HMAC-SHA256(derivar(ADMIN_TOKEN_SECRET), code)`. La firma no autentica a una
persona: **autoriza el acceso a un pedido**.

- **Determinística**: los tres mails llevan el mismo link y uno viejo sigue
  andando. Cero tablas, cero sesiones, cero expiración que explicarle a nadie.
- **Clave derivada**, no el secreto de admin: un link filtrado no acerca a nadie
  a las sesiones del panel.
- **404, no 401**, ante un token inválido: con el mismo mensaje que un código
  inexistente, así la respuesta no confirma qué pedidos existen.
- La respuesta es un `PublicOrder`: **sin teléfono ni mail**, porque un link se
  reenvía.

---

## Arquitectura

```
shared/     Dominio y contratos que usan las dos puntas
  domain/     Producto, pedido, teléfono, tablas de talles, motor de promociones
  schemas/    Esquemas zod: una sola definición de "válido" para cliente y servidor
server/     Backend independiente de framework
  http/       Router, tipos de request/response, errores, validación
  security/   JWT HS256, rate limit, guard de admin
  infra/      Repositorios de Supabase, mappers fila↔dominio, storage
  modules/    Un módulo por recurso: servicio (reglas) + rutas (HTTP)
  adapters/   Node ⇄ núcleo HTTP
api/        Una sola Function catch-all de Vercel que delega en server/
tools/      Plugin de Vite que monta la misma API en el dev-server
src/        Cliente React
  services/   Capa de acceso a la API (ningún componente llama a fetch)
  store/      Carrito, catálogo y tabla de talles (zustand)
  ui/         Primitivas reutilizables (Button, Field, Modal, ChipGroup…)
  components/ Vistas por dominio
db/         Migración y seed SQL
scripts/    Setup de base sin copiar y pegar SQL en el dashboard
tests/      Vitest sobre dominio, promociones, servicios, seguridad y router
```

La regla que ordena todo: **las dependencias apuntan hacia adentro**.
`shared/` no sabe nada de HTTP ni de React; `server/modules` no sabe qué base de
datos hay detrás (habla con interfaces `ProductRepository`, `OrderRepository`,
`PromotionRepository`); `src/components` no sabe cómo viaja un pedido.

Dos consecuencias concretas:

- Los tests de `ordersService` y del motor de promos corren contra dobles en
  memoria, sin Supabase ni red, y validan las reglas reales de precio y talle.
- El carrito y el servidor calculan el descuento con **la misma función**
  (`evaluatePromotions`), así que la previsualización no puede diferir del
  importe final: es literalmente el mismo código.

---

## Decisiones de seguridad

| Antes | Ahora |
| --- | --- |
| La clave admin se comparaba en el browser contra `VITE_ADMIN_PASSWORD` (con fallback hardcodeado). Viajaba dentro del bundle | Se compara en el servidor, en tiempo constante, contra `ADMIN_PASSWORD`. Nunca sale del backend |
| `sessionStorage.setItem('camg_admin','true')` desde la consola daba acceso total | La sesión es un JWT firmado; cada endpoint revalida la firma. El guard del cliente es sólo cosmético |
| El cliente enviaba `unitPrice` y `total` al crear el pedido | El servidor resuelve el tier del talle, busca el precio en la base y recalcula las promos |
| La anon key en el bundle permitía leer la tabla `orders` completa (nombres y montos de todos los socios) | RLS activado sin policies: anon y authenticated no tienen acceso. El único camino es la API con `service_role` |
| Sin límite de intentos de login | Ventana deslizante: 8 intentos cada 5 minutos por IP |
| Para saber en qué andaba su pedido, el socio tenía que escribir al club | Link firmado por HMAC en cada mail. Sin login, sin exponer la tabla y sin devolver datos de contacto |

El CAPTCHA del login sigue siendo client-side y **no** es una defensa: es
fricción contra bots triviales. La protección real es el rate limit del servidor.

---

## Imágenes

Los originales viven en `public/images` y **no se tocan**: son el archivo de
trabajo del club y el fallback del `<picture>`. `npm run images` genera los
derivados WebP en `public/images/opt` y escribe `shared/media/imageManifest.ts`
con los anchos que realmente quedaron en disco.

El `srcset` sale del manifiesto y no de la configuración, porque el generador
saltea los anchos mayores al original: pedir `pantalon-1200.webp` cuando el
original mide 1122 devolvía un 404.

En el componente `<Picture>` el `src` sigue siendo la ruta original —la que
guarda la base y la que edita el admin—, así que una imagen subida a Supabase
Storage, que no tiene derivados, se degrada sola a un `<img>` común.

| | Antes | Ahora |
| --- | --- | --- |
| Set completo | 4,9 MB | 746 KB en derivados |
| Home entera, scrolleada | ~1,5 MB en el primer viewport | **182 KB**, sin bajar un solo original |
