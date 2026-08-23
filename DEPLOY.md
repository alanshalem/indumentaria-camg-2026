# Volver a levantar todo, de cero

Guía para reconstruir el proyecto después de borrar Supabase y Vercel.
Tiempo estimado: 15 minutos. Seguí los pasos en orden.

---

## 1 · Crear el proyecto de Supabase

1. Entrá a [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Completá:
   - **Name**: `camg-indumentaria`
   - **Database Password**: generala con el botón y **guardala** — la vas a necesitar en el paso 3 y no se puede volver a ver.
   - **Region**: `South America (São Paulo)` — es la más cercana, baja la latencia.
3. **Create new project** y esperá ~2 minutos a que termine de aprovisionar.

## 2 · Copiar las credenciales

Con el proyecto listo, necesitás tres cosas:

| Qué | Dónde |
| --- | --- |
| **Project URL** | Settings → API → *Project URL* |
| **Secret key** | Settings → **API Keys** → la key `sb_secret_...` → *Reveal* |
| **Connection string** | Botón **Connect** (arriba) → pestaña **Direct · Connection string** → adentro elegí **Session pooler** → copiá el URI |

> **Sobre las API keys.** Supabase renombró el par de claves: donde antes decía
> `anon` / `service_role` (formato `eyJ...`), ahora dice **publishable**
> (`sb_publishable_...`) y **secret** (`sb_secret_...`). La que necesitás es la
> **secret**: cumple el mismo rol que la vieja `service_role` y sortea todas las
> políticas de seguridad de la base. La *publishable* no sirve acá — con ella
> todos los endpoints fallan.
>
> La secret key va únicamente en variables de entorno del servidor. Nunca en el
> código, nunca con prefijo `VITE_`, nunca en un commit.

En el connection string reemplazá `[YOUR-PASSWORD]` por la contraseña de la
**base** del paso 1 — no es una API key. Si la perdiste:
Settings → Database → *Reset database password*.

## 3 · Configurar `.env.local`

En la raíz del proyecto, copiá `.env.example` a `.env.local` y completalo:

```bash
cp .env.example .env.local
```

```env
SUPABASE_URL=https://xxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
ADMIN_PASSWORD=la-clave-del-panel
ADMIN_TOKEN_SECRET=<generar, ver abajo>
DATABASE_URL=postgresql://postgres.xxxx:TU-PASSWORD@aws-1-sa-east-1.pooler.supabase.com:5432/postgres
```

Para generar el secreto de sesión:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

> **Cambiá `ADMIN_PASSWORD`.** La clave vieja (`PauCAMG26`) quedó en el
> historial de git de cuando se comparaba en el browser: hay que darla por
> comprometida.

## 4 · Crear las tablas y cargar el catálogo

```bash
npm install
npm run db:setup
```

Esto aplica `db/migrations/0001_init.sql` (tablas, índices, RLS y bucket de
imágenes), después `db/seed.sql` (los 8 productos de la lista de Agosto 2026 y
las 2 promociones), y al final imprime el estado de la base para verificar:

```
  Estado de la base:
    productos ............ 8 (8 visibles)
    promociones activas .. 2
    pedidos .............. 0
    bucket de imágenes ... ok
```

Si algo falla acá, no sigas: el resto depende de esto.

## 5 · Probar en local

```bash
npm run dev
```

- `http://localhost:5173` → catálogo con los 8 productos, promos y tablas de talles.
- `http://localhost:5173/login` → panel, con la `ADMIN_PASSWORD` que pusiste.

Probá el circuito completo: agregá un buzo ½ cierre + un pantalón al carrito y
verificá que aparezca el descuento del combo antes de confirmar.

## 6 · Subir el código

```bash
git add -A
git commit -m "..."
git push origin main
```

## 7 · Crear el proyecto en Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** →
   `alanshalem/indumentaria-camg-2026`.
2. **Framework Preset**: Vite (lo detecta solo). No toques Build Command ni
   Output Directory.
3. Abrí **Environment Variables** y cargá estas cuatro, para los tres entornos
   (Production, Preview, Development):

   | Name | Value |
   | --- | --- |
   | `SUPABASE_URL` | el Project URL del paso 2 |
   | `SUPABASE_SERVICE_ROLE_KEY` | la **secret key** (`sb_secret_...`) del paso 2 |
   | `ADMIN_PASSWORD` | la clave del panel |
   | `ADMIN_TOKEN_SECRET` | el secreto generado en el paso 3 |

   `DATABASE_URL` **no** hace falta en Vercel: sólo la usan los scripts de base
   desde tu máquina. Menos secretos en el servidor, menos superficie.

4. **Deploy**.

## 8 · Verificar el deploy

Con la URL que te da Vercel:

1. La home carga los 8 productos → la API y la base están conectadas.
2. `/api/products` devuelve JSON → las Functions están corriendo.
3. `/login` con tu `ADMIN_PASSWORD` → entrás al panel.
4. Panel → Productos → **Editar** cualquiera → **Subir archivo** → si la imagen
   sube, el bucket de Storage quedó bien.
5. Generá un pedido de prueba desde la home y verificá que aparezca en
   Pedidos, con el teléfono clickeable a WhatsApp.

---

## Mails automáticos (Resend)

El pedido pasa por cuatro estados y tres de ellos le mandan un mail al socio:

| Estado | Mail |
| --- | --- |
| Pendiente de pago | *Recibimos tu pedido* — código, detalle, total y cómo pagar |
| Pago confirmado | *Confirmamos tu pago* — ya lo encargamos |
| Listo para retirar | *Pasá a buscarlo* — dirección y horarios |
| Entregado | ninguno |

El estado se cambia desde **Panel → Pedidos → columna Estado**. Cada aviso se
manda **una sola vez por pedido**: si movés el estado de ida y vuelta, el socio
no recibe repetidos.

**Sin `RESEND_API_KEY` la app funciona igual.** Los envíos quedan registrados
como `skipped` en la tabla `email_log` y ningún pedido falla por esto.

### Configurar el dominio del remitente, paso a paso

Dominio: **clubatleticomontegrande.com.ar**, comprado en nic.ar **sólo para
mandar mails**. El sitio sigue viviendo en `indumentaria-camg-2026.vercel.app`.

> **El dominio del remitente y el del sitio son independientes.** Los mails
> pueden salir desde `pedidos@clubatleticomontegrande.com.ar` mientras la tienda
> sigue en `.vercel.app`. Tampoco hace falta crear la casilla `pedidos@`: es sólo
> el remitente. Los mails son de **sólo ida**: nadie contesta esa casilla, y el
> pie de cada mail remite al WhatsApp del club.

#### 0 · Sacar el dominio del proyecto de Vercel

Si lo agregaste en Vercel → Settings → Domains, **quitalo** (la raíz y el `www`).
No va a servir la página, así que sólo deja dos carteles de *Invalid
Configuration* para siempre y un redirect que no querés.

#### 1 · Un DNS donde vivan los registros

**NIC.ar no hospeda registros**: sólo delega el dominio a servidores externos y
ahí se cargan `MX`, `TXT`, etc. Así que hace falta un DNS host. Cloudflare es
gratis y alcanza de sobra:

1. [cloudflare.com](https://dash.cloudflare.com) → cuenta gratis →
   **Add a site** → `clubatleticomontegrande.com.ar` → plan **Free**.
2. Te da **dos nameservers** (`algo.ns.cloudflare.com`). Copialos.
3. [nic.ar](https://nic.ar) → Clave Fiscal → **Mis dominios** → el dominio →
   **Delegación** → cargás esos dos hostnames.

   > Dos trampas de esa pantalla:
   > - **No tildes "Autodelegar".** Esa opción es sólo para nameservers que viven
   >   dentro del propio dominio (`ns1.tudominio.com.ar`). Los de Cloudflare son
   >   externos; si la tildás te pide IPs y la delegación queda mal.
   > - **No cargues IPs.** Cloudflare ya tiene sus registros de pegamento en el
   >   TLD, nic.ar los resuelve solo.
   >
   > Cloudflare asigna el mismo par de nameservers a todas las zonas de una
   > misma cuenta, así que si ya tenés otros dominios ahí, van a ser los mismos.
   > Igual confirmá contra lo que muestre Cloudflare para *esta* zona: un
   > nameserver equivocado son 24–48 h de ida y vuelta.
4. La propagación puede tardar hasta 24–48 h, aunque suele ser bastante menos.
   Cloudflare te avisa por mail cuando el dominio queda *Active*.

#### 2 · Verificar el dominio en Resend

1. [resend.com](https://resend.com) → cuenta → **Domains → Add Domain**.
2. Escribí el dominio **con muchísimo cuidado**: `clubatleticomontegrande.com.ar`.
   Un typo acá no da error — Resend acepta cualquier texto y te genera registros
   para un dominio que no controlás. Después nunca verifica y no se entiende por
   qué. Si te equivocaste: borrá ese dominio en Resend y agregalo de nuevo (la
   clave DKIM se regenera, así que no sirven los registros viejos).
3. Elegí la región más cercana (São Paulo).
4. Resend te lista los registros. **Hay dos variantes** según la cuenta y la
   región, así que copiá los de tu panel, no los de acá:

   | Variante | Registros |
   | --- | --- |
   | CNAME | `TXT resend._domainkey` + `CNAME send` y `CNAME rsend` hacia `…forge.rmta.net` |
   | MX/SPF | `TXT resend._domainkey` + `MX send` y `TXT send` (SPF) |

5. Cloudflare → **DNS → Records → Add record** → cargás los que te haya dado.

   > **Tres trampas de Cloudflare acá:**
   > - **Los CNAME hay que ponerlos en "DNS only" (nube gris), NO proxeados.**
   >   Cloudflare deja el proxy prendido por defecto y eso rompe el mail. Los
   >   `TXT` y `MX` no tienen esa opción, sólo los `CNAME`.
   > - En *Name* va **sólo la parte corta** (`send`, `rsend`,
   >   `resend._domainkey`). Cloudflare le agrega el dominio solo; si escribís el
   >   nombre completo queda duplicado.
   > - El valor del DKIM es largo: pegalo entero, sin cortar ni agregar espacios.

6. **Ignorá la sección "Enable Receiving"** de Resend. Eso es para recibir mails
   en el dominio y agrega `MX` en la raíz: no lo necesitás —los mails son de sólo
   ida— y esos `MX` chocarían con Zoho si alguna vez lo sumás.
7. Resend → **Verify**. Tarda unos minutos.

#### 3 · La API key

Resend → **API Keys → Create API Key**, permiso *Sending access*. Empieza con
`re_` y **se muestra una sola vez**.

#### 4 · Cargar las variables

En `.env.local` y en Vercel → **Settings → Environment Variables**:

```env
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=CAMG <pedidos@clubatleticomontegrande.com.ar>

# El SITIO no se mudó: esto queda apuntando a Vercel.
PUBLIC_SITE_URL=https://indumentaria-camg-2026.vercel.app
```

`EMAIL_REPLY_TO` **no se carga**: sin reply-to, una respuesta rebota contra una
casilla que no existe, que es justamente lo que queremos. Está documentada en
`.env.example` por si algún día el club quiere recibir respuestas.

`PUBLIC_SITE_URL` no es sólo el logo: de ahí sale el link *"Ver el estado de mi
pedido"* que lleva cada mail. Mal apuntada, el botón va a un sitio que no existe.

Los datos del club —alias de pago, dirección, horarios, teléfono— **no son
variables de entorno**: viven en `shared/domain/club.ts`. No son secretos (salen
impresos en cada mail) y como env vars fallaban en silencio: si faltaba alguna
en Vercel, el mail salía igual pero sin decir cómo pagar.

**En Vercel, las variables nuevas exigen un redeploy** para tomar efecto
(Deployments → el último → *Redeploy*).

#### 5 · Probar antes de que lo vea un socio

```bash
npm run email:test -- tumail@gmail.com
npm run email:test -- tumail@gmail.com paymentConfirmed
npm run email:test -- tumail@gmail.com readyForPickup
```

Usa la misma plantilla, el mismo transporte y la misma config que un pedido
real, pero con datos inventados: no ensucia el panel.

#### 6 · Si algo falla

| Síntoma | Causa |
| --- | --- |
| `Omitido: Falta RESEND_API_KEY` | No cargaste la variable, o corrés sin `.env.local` |
| `Falló: ... 403` | El dominio todavía no está verificado en Resend |
| `Falló: ... 422` | El dominio de `EMAIL_FROM` no es el verificado |
| Resend no verifica | El dominio todavía no propagó: `nslookup -type=NS clubatleticomontegrande.com.ar 8.8.8.8` tiene que devolver los NS de Cloudflare |
| Llega pero sin logo | `PUBLIC_SITE_URL` mal: apuntá a donde vive el SITIO, no al dominio del remitente |

Historial de envíos de pedidos reales:

```sql
select order_code, kind, status, error, created_at
from email_log order by created_at desc limit 20;
```

#### 7 · Opcionales

**DMARC** (mejora la entrega). En Cloudflare, un `TXT` más:

```
Nombre: _dmarc
Valor:  v=DMARC1; p=none; rua=mailto:elgmaildelclub@gmail.com
```

`p=none` sólo observa, no bloquea. Es el modo seguro para empezar.

**Que el dominio lleve a la tienda.** Como no sirve la página, entrar a
`clubatleticomontegrande.com.ar` no muestra nada. Si querés, en Cloudflare →
**Rules → Redirect Rules** podés mandarlo a la URL de Vercel. Es opcional y no
afecta a los mails.

### Datos del club en los mails

Editás `shared/domain/club.ts` y deployás:

```ts
export const CLUB: ClubInfo = {
  name: 'Club Atlético Monte Grande',
  shortName: 'CAMG',

  paymentAlias: '',      // ← FALTA: alias de transferencia
  contactPhone: '',      // ← FALTA: WhatsApp del club

  pickupAddress: 'Hipólito Yrigoyen 77, Monte Grande, Argentina',
  // Una entrada por bloque de días: cada una va en su propio renglón.
  pickupHours: ['Lunes, miércoles y viernes de 18 a 19', 'Martes y jueves de 17 a 18'],
  ...
};
```

Un campo vacío **no rompe nada**: el mail omite esa fila —o el recuadro entero,
si no queda ninguna— en vez de mostrar una etiqueta sin valor. Cuando cargues el
WhatsApp aparece solo en los tres mails y en la página de seguimiento.
`npm run email:test` avisa cuáles faltan antes de enviar.

---

## Después, para el día a día

| Necesito… | Comando / lugar |
| --- | --- |
| Cambiar un precio | Panel → Productos → Editar |
| Apagar una promo | Panel → Promos → botón *Activa/Apagada* |
| Cambiar el monto de un combo | Panel → Promos → *Editar valores* |
| Agregar un producto nuevo | Panel → Productos → *+ Nuevo producto* |
| Recargar el catálogo del manual | `npm run db:seed` (no pisa las promos apagadas) |
| Ver qué hay cargado | `npm run db:check` |
| Cambiar el estado de un pedido (manda el mail) | Panel → Pedidos → columna *Estado* |

Cambiar precios o promos desde el panel **no requiere redeploy**: los pedidos ya
generados conservan los importes con los que se cerraron.

---

## Si algo sale mal

| Síntoma | Causa casi siempre |
| --- | --- |
| `Faltan variables de entorno del servidor: …` | Falta cargar esa variable en Vercel, o se cargó sólo en Production. Redeploy después de agregarla. |
| Home carga pero el catálogo queda vacío | Faltó correr `npm run db:seed`. |
| `No se pudo completar la operación en la base de datos` | Pegaste la key *publishable* en vez de la *secret*, o es de otro proyecto. |
| El login dice `Demasiados intentos` | Rate limit: 8 intentos cada 5 minutos por IP. Esperá. |
| La subida de imágenes falla | El bucket `product-images` no se creó: volvé a correr `npm run db:migrate`. |
| `npm run db:setup` no conecta | El `DATABASE_URL` quedó con `[YOUR-PASSWORD]` sin reemplazar, usaste una API key como contraseña, o copiaste el URI *Direct connection* en vez del *Session pooler*. |
