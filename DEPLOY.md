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

## Después, para el día a día

| Necesito… | Comando / lugar |
| --- | --- |
| Cambiar un precio | Panel → Productos → Editar |
| Apagar una promo | Panel → Promos → botón *Activa/Apagada* |
| Cambiar el monto de un combo | Panel → Promos → *Editar valores* |
| Agregar un producto nuevo | Panel → Productos → *+ Nuevo producto* |
| Recargar el catálogo del manual | `npm run db:seed` (no pisa las promos apagadas) |
| Ver qué hay cargado | `npm run db:check` |

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
