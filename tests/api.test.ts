import './support/serverEnv';
import { describe, expect, it } from 'vitest';
import { ROUTES } from '../shared/api/contracts';
import type { OrderCreated, OrderStatusUpdate } from '../shared/api/contracts';
import type { Order, PublicOrder } from '../shared/domain/order';
import type { Product } from '../shared/domain/product';
import type { WhatsappLogRecord } from '../shared/domain/whatsapp';
import { apiRouter } from '../server/app';
import { signOrderToken } from '../server/security/orderToken';
import {
  adminToken,
  CUSTOMER,
  dataOf,
  errorOf,
  order,
  product,
  testApi,
  TEST_PASSWORD,
} from './doubles';

/**
 * Tests del borde HTTP: la capa que no tenía ninguno.
 *
 * Son el motivo por el que los routers pasaron a ser fábricas. Lo que se
 * ejercita acá —matcheo de rutas, `adminOnly`, la validación de zod, los
 * códigos de estado, el sobre de error y los headers— antes sólo se podía
 * probar contra Supabase, así que no se probaba. Debajo corren los servicios
 * reales sobre repositorios en memoria: la pila entera menos la base.
 */

const UN_PEDIDO = {
  ...CUSTOMER,
  items: [{ productId: 'campera-canguro', size: 'M', quantity: 1 }],
};

const conCatalogo = (overrides: Partial<Product> = {}) =>
  testApi({ products: [product(overrides)] });

// ---------------------------------------------------------------------------

describe('ruteo', () => {
  it('una ruta que no existe es 404 y lo dice', async () => {
    const response = await testApi().request('GET', '/no-existe');

    expect(response.status).toBe(404);
    expect(errorOf(response).code).toBe('NOT_FOUND');
    expect(errorOf(response).message).toContain('/no-existe');
  });

  it('distingue "no existe la ruta" de "no existe ese método"', async () => {
    const api = testApi();

    const ruta = errorOf(await api.request('GET', '/fantasma')).message;
    const metodo = errorOf(await api.admin('DELETE', ROUTES.orders.collection)).message;

    expect(ruta).toContain('no encontrada');
    expect(metodo).toContain('no permitido');
  });

  it('un parámetro de ruta llega decodificado', async () => {
    // `/products/:id` con un id que trae espacio: si no se decodifica, el
    // servicio busca "campera%20rara" y nunca encuentra nada.
    const api = conCatalogo();
    const response = await api.admin('PATCH', '/products/campera%20rara', {
      body: { name: 'Nombre nuevo' },
    });

    // El doble no tiene ese producto, así que explota al intentar actualizarlo;
    // lo que importa es que el 404 de ruta no se disparó.
    expect(response.status).not.toBe(404);
  });

  it('las rutas largas no las tapa la corta del mismo prefijo', async () => {
    // `/orders/summary` y `/orders/:code` tienen el mismo largo: si el router
    // las confundiera, el resumen del panel entraría por el seguimiento.
    const response = await testApi().admin('GET', ROUTES.orders.summary);

    expect(response.status).toBe(200);
    expect(dataOf(response)).toMatchObject({ revenue: 0, counted: 0 });
  });
});

describe('el sobre de la respuesta', () => {
  it('lo exitoso viaja en { data }', async () => {
    const response = await conCatalogo().request('GET', ROUTES.products.collection);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(dataOf<Product[]>(response)).toHaveLength(1);
  });

  it('todo error viaja en { error: { code, message } }', async () => {
    const response = await testApi().request('GET', '/nada');

    expect(Object.keys(response.body as object)).toEqual(['error']);
    expect(errorOf(response)).toMatchObject({ code: expect.any(String), message: expect.any(String) });
  });

  it('ninguna respuesta se cachea y todas llevan los headers de seguridad', async () => {
    const api = conCatalogo();

    for (const response of [
      await api.request('GET', ROUTES.products.collection),
      await api.request('GET', '/nada'),
      await api.request('GET', ROUTES.orders.collection),
    ]) {
      expect(response.headers?.['Cache-Control']).toBe('no-store');
      expect(response.headers?.['X-Content-Type-Options']).toBe('nosniff');
      expect(response.headers?.['Referrer-Policy']).toBe('no-referrer');
    }
  });
});

describe('autorización', () => {
  const PROTEGIDAS = [
    ['GET', ROUTES.orders.collection],
    ['GET', ROUTES.orders.summary],
    ['PATCH', ROUTES.orders.byCode('CAMG-2026-ABCDE')],
    ['PATCH', ROUTES.orders.items('CAMG-2026-ABCDE')],
    ['PATCH', ROUTES.orders.payment('CAMG-2026-ABCDE')],
    ['GET', ROUTES.orders.whatsapp('CAMG-2026-ABCDE')],
    ['POST', ROUTES.orders.whatsapp('CAMG-2026-ABCDE')],
    ['GET', ROUTES.orders.emails('CAMG-2026-ABCDE')],
    ['POST', ROUTES.products.collection],
    ['PATCH', ROUTES.products.byId('campera-canguro')],
    ['PATCH', ROUTES.products.stock('campera-canguro')],
    ['DELETE', ROUTES.products.byId('campera-canguro')],
    ['POST', ROUTES.promotions.collection],
    ['PATCH', ROUTES.promotions.byId('combo')],
    ['DELETE', ROUTES.promotions.byId('combo')],
    ['POST', ROUTES.uploads.productImage],
    ['GET', ROUTES.emails.preview],
    ['GET', ROUTES.auth.session],
  ] as const;

  it('sin token, toda ruta de admin devuelve 401', async () => {
    const api = testApi();

    for (const [method, path] of PROTEGIDAS) {
      const response = await api.request(method, path, { body: {} });
      expect(`${method} ${path} → ${response.status}`).toBe(`${method} ${path} → 401`);
    }
  });

  it('un token inventado también es 401', async () => {
    const response = await testApi().request('GET', ROUTES.orders.collection, {
      token: 'no.es.un.token',
    });

    expect(response.status).toBe(401);
    expect(errorOf(response).code).toBe('UNAUTHORIZED');
  });

  it('un token vencido es 401 y dice que expiró', async () => {
    const response = await testApi().request('GET', ROUTES.orders.collection, {
      token: adminToken(-1000),
    });

    expect(response.status).toBe(401);
    expect(errorOf(response).message).toContain('expiró');
  });

  it('con una sesión válida pasa', async () => {
    const response = await testApi().admin('GET', ROUTES.orders.collection);

    expect(response.status).toBe(200);
    expect(dataOf(response)).toMatchObject({ total: 0 });
  });
});

describe('lectura mixta del catálogo', () => {
  it('el visitante no ve los despublicados y el admin sí', async () => {
    const api = testApi({ products: [product(), product({ id: 'oculta', isActive: false })] });

    const visitante = await api.request('GET', ROUTES.products.collection, {
      query: { includeInactive: 'true' },
    });
    const admin = await api.admin('GET', ROUTES.products.collection, {
      query: { includeInactive: 'true' },
    });

    // El visitante puede pedir `includeInactive`: lo que no puede es obtenerlo.
    expect(dataOf<Product[]>(visitante)).toHaveLength(1);
    expect(dataOf<Product[]>(admin)).toHaveLength(2);
  });
});

describe('validación', () => {
  it('un pedido sin nada devuelve 422 y señala los campos', async () => {
    const response = await testApi().request('POST', ROUTES.orders.collection, { body: {} });

    expect(response.status).toBe(422);
    expect(errorOf(response).code).toBe('VALIDATION_ERROR');
    expect(Object.keys(errorOf(response).fields ?? {})).toEqual(
      expect.arrayContaining(['customerName', 'customerLastName', 'phone', 'email', 'paymentMethod']),
    );
  });

  it('un estado que no existe no llega al servicio', async () => {
    const response = await testApi().admin('GET', ROUTES.orders.collection, {
      query: { status: 'inventado' },
    });

    expect(response.status).toBe(422);
    expect(errorOf(response).message).toContain('Filtros inválidos');
  });

  it('un código de pedido con otra forma se rechaza antes de buscarlo', async () => {
    const response = await testApi().request('GET', '/orders/pedido-cualquiera');

    expect(response.status).toBe(422);
    expect(errorOf(response).message).toContain('Código inválido');
  });

  it('un link de pago que no es URL se rechaza', async () => {
    const api = testApi({ orders: [order()] });

    const response = await api.admin('PATCH', ROUTES.orders.payment('CAMG-2026-ABCDE'), {
      body: { method: 'mercadopago', link: 'javascript:alert(1)' },
    });

    expect(response.status).toBe(422);
    expect(errorOf(response).message).toContain('http');
  });

  it('una plantilla de WhatsApp desconocida se rechaza', async () => {
    const api = testApi({ orders: [order()] });

    const response = await api.admin('POST', ROUTES.orders.whatsapp('CAMG-2026-ABCDE'), {
      body: { template: 'la-que-se-me-ocurra' },
    });

    expect(response.status).toBe(422);
  });
});

describe('POST /orders · el checkout', () => {
  it('crea el pedido con 201 y devuelve el token de seguimiento', async () => {
    const api = conCatalogo();

    const response = await api.request('POST', ROUTES.orders.collection, { body: UN_PEDIDO });

    expect(response.status).toBe(201);
    const { order: creado, statusToken } = dataOf<OrderCreated>(response);
    expect(creado.code).toMatch(/^CAMG-\d{4}-/);
    expect(creado.total).toBe(54000);
    expect(statusToken).toBe(signOrderToken(creado.code));
    expect(api.state.orders).toHaveLength(1);
  });

  it('es público: no necesita sesión', async () => {
    const response = await conCatalogo().request('POST', ROUTES.orders.collection, {
      body: UN_PEDIDO,
    });

    expect(response.status).toBe(201);
  });

  it('el método de pago que eligió el socio llega al pedido guardado', async () => {
    // Es el camino que el bug de `payment_method` rompía: el dato salía del
    // checkout y se perdía antes de quedar guardado.
    const api = conCatalogo();

    await api.request('POST', ROUTES.orders.collection, {
      body: { ...UN_PEDIDO, paymentMethod: 'cash' },
    });

    expect(api.state.orders[0]?.paymentMethod).toBe('cash');
  });

  it('el precio lo pone el servidor, no el cuerpo del request', async () => {
    const api = conCatalogo();

    await api.request('POST', ROUTES.orders.collection, {
      body: {
        ...UN_PEDIDO,
        items: [{ productId: 'campera-canguro', size: 'M', quantity: 1, unitPrice: 1, total: 1 }],
      },
    });

    expect(api.state.orders[0]?.items[0]?.unitPrice).toBe(54000);
    expect(api.state.orders[0]?.total).toBe(54000);
  });

  it('el nombre y el teléfono quedan normalizados', async () => {
    const api = conCatalogo();

    await api.request('POST', ROUTES.orders.collection, {
      body: { ...UN_PEDIDO, customerName: 'NATALIA', customerLastName: 'bacchetto', phone: '11 6278-8263' },
    });

    expect(api.state.orders[0]?.customerName).toBe('Natalia');
    expect(api.state.orders[0]?.customerLastName).toBe('Bacchetto');
    expect(api.state.orders[0]?.phone).toBe('1162788263');
  });

  it('avisa por mail al crearlo', async () => {
    const api = conCatalogo();

    await api.request('POST', ROUTES.orders.collection, { body: UN_PEDIDO });

    expect(api.state.sent).toHaveLength(1);
    expect(api.state.sent[0]?.to).toBe('ana@ejemplo.com');
  });

  it('una prenda sin stock se vende igual y queda marcada a pedido', async () => {
    const api = testApi({ products: [product()], stock: { 'campera-canguro|M|': 0 } });

    const response = await api.request('POST', ROUTES.orders.collection, { body: UN_PEDIDO });

    expect(response.status).toBe(201);
    expect(dataOf<OrderCreated>(response).order.items[0]?.backorderedUnits).toBe(1);
  });
});

describe('GET /orders/:code · el seguimiento del mail', () => {
  const guardado = order({ code: 'CAMG-2026-ABCDE' });

  it('con la firma del mail devuelve el pedido', async () => {
    const api = testApi({ orders: [guardado] });

    const response = await api.request('GET', ROUTES.orders.byCode(guardado.code), {
      query: { t: signOrderToken(guardado.code) },
    });

    expect(response.status).toBe(200);
    expect(dataOf<PublicOrder>(response).code).toBe(guardado.code);
  });

  it('sin firma es 404, no 401: la respuesta no confirma que el pedido exista', async () => {
    const api = testApi({ orders: [guardado] });

    const sinToken = await api.request('GET', ROUTES.orders.byCode(guardado.code));
    const inexistente = await api.request('GET', ROUTES.orders.byCode('CAMG-2026-FANTA'), {
      query: { t: signOrderToken('CAMG-2026-FANTA') },
    });

    expect(sinToken.status).toBe(404);
    expect(errorOf(sinToken).message).toBe(errorOf(inexistente).message);
  });

  it('no expone el teléfono ni el mail del socio', async () => {
    const api = testApi({ orders: [guardado] });

    const response = await api.request('GET', ROUTES.orders.byCode(guardado.code), {
      query: { t: signOrderToken(guardado.code) },
    });

    expect(JSON.stringify(response.body)).not.toContain(guardado.phone);
    expect(JSON.stringify(response.body)).not.toContain('ana@ejemplo.com');
  });
});

describe('PATCH /orders/:code/items · control interno', () => {
  it('marca la prenda y NO le manda ningún mail al socio', async () => {
    // La regla que el club pidió explícitamente. Es la que más fácil se rompe
    // sin darse cuenta, porque el camino del mail pasa por al lado.
    const api = testApi({ orders: [order()] });

    const response = await api.admin('PATCH', ROUTES.orders.items('CAMG-2026-ABCDE'), {
      body: { index: 0, delivered: true },
    });

    expect(response.status).toBe(200);
    expect(dataOf<Order>(response).items[0]?.delivered).toBe(true);
    expect(api.state.sent).toEqual([]);
  });

  it('no toca el estado del pedido', async () => {
    const api = testApi({ orders: [order({ status: 'paid' })] });

    const response = await api.admin('PATCH', ROUTES.orders.items('CAMG-2026-ABCDE'), {
      body: { index: 1, delivered: true },
    });

    expect(dataOf<Order>(response).status).toBe('paid');
    expect(dataOf<Order>(response).items[0]?.delivered).toBe(false);
  });

  it('una línea que no existe es 404', async () => {
    const api = testApi({ orders: [order()] });

    const response = await api.admin('PATCH', ROUTES.orders.items('CAMG-2026-ABCDE'), {
      body: { index: 9, delivered: true },
    });

    expect(response.status).toBe(404);
  });
});

describe('PATCH /orders/:code · el estado sí avisa', () => {
  it('cambia el estado, manda el aviso y cuenta qué mandó', async () => {
    const api = testApi({ orders: [order()] });

    const response = await api.admin('PATCH', ROUTES.orders.byCode('CAMG-2026-ABCDE'), {
      body: { status: 'ready' },
    });

    expect(response.status).toBe(200);
    const update = dataOf<OrderStatusUpdate>(response);
    expect(update.order.status).toBe('ready');
    expect(update.notice).toMatchObject({ kind: 'readyForPickup', status: 'sent' });
    expect(api.state.sent).toHaveLength(1);
  });

  it('informa los avisos que quedaron sin mandar al saltear etapas', async () => {
    // El caso que confundió al club: marcar "Entregado" directo desde
    // "Pendiente" no manda nada, y sin esto el panel no lo dice.
    const api = testApi({ orders: [order()] });

    const response = await api.admin('PATCH', ROUTES.orders.byCode('CAMG-2026-ABCDE'), {
      body: { status: 'delivered' },
    });

    const update = dataOf<OrderStatusUpdate>(response);
    expect(update.notice).toBeNull();
    expect(update.missed).toEqual([
      'orderReceived',
      'depositReceived',
      'paymentConfirmed',
      'readyForPickup',
    ]);
  });
});

describe('PATCH /orders/:code/payment', () => {
  it('guarda el método que corrigió el club', async () => {
    const api = testApi({ orders: [order({ paymentMethod: 'mercadopago' })] });

    const response = await api.admin('PATCH', ROUTES.orders.payment('CAMG-2026-ABCDE'), {
      body: { method: 'cash', link: null },
    });

    expect(dataOf<Order>(response).paymentMethod).toBe('cash');
  });

  it('un cuerpo vacío lo deja sin definir, sin romper', async () => {
    const api = testApi({ orders: [order({ paymentMethod: 'cash' })] });

    const response = await api.admin('PATCH', ROUTES.orders.payment('CAMG-2026-ABCDE'), {
      body: {},
    });

    expect(response.status).toBe(200);
    expect(dataOf<Order>(response).paymentMethod).toBeNull();
  });
});

describe('WhatsApp · qué se le preparó al socio', () => {
  it('arranca sin historial', async () => {
    const api = testApi({ orders: [order()] });

    const response = await api.admin('GET', ROUTES.orders.whatsapp('CAMG-2026-ABCDE'));

    expect(dataOf<WhatsappLogRecord[]>(response)).toEqual([]);
  });

  it('registrar devuelve el historial actualizado', async () => {
    const api = testApi({ orders: [order()] });

    await api.admin('POST', ROUTES.orders.whatsapp('CAMG-2026-ABCDE'), {
      body: { template: 'paymentLink' },
    });
    const response = await api.admin('POST', ROUTES.orders.whatsapp('CAMG-2026-ABCDE'), {
      body: { template: 'cash' },
    });

    const historial = dataOf<WhatsappLogRecord[]>(response);
    expect(historial.map((record) => record.template)).toEqual(['cash', 'paymentLink']);
  });
});

describe('POST /auth/login', () => {
  it('con la clave correcta devuelve un token que abre el panel', async () => {
    const api = testApi();

    const login = await api.request('POST', ROUTES.auth.login, {
      body: { password: TEST_PASSWORD },
    });

    expect(login.status).toBe(200);
    const { token } = dataOf<{ token: string; expiresAt: number }>(login);
    const session = await api.request('GET', ROUTES.auth.session, { token });
    expect(session.status).toBe(200);
    expect(dataOf<{ authenticated: boolean }>(session).authenticated).toBe(true);
  });

  it('con la clave incorrecta es 401 y no dice nada más', async () => {
    const response = await testApi().request('POST', ROUTES.auth.login, {
      body: { password: 'la-que-no-es' },
    });

    expect(response.status).toBe(401);
    expect(errorOf(response).message).toBe('Clave incorrecta.');
  });
});

describe('POST /uploads/product-image', () => {
  it('una imagen vacía no llega al storage', async () => {
    const api = testApi();

    const response = await api.admin('POST', ROUTES.uploads.productImage, {
      body: { fileName: 'campera.png', contentType: 'image/png', dataBase64: '' },
    });

    // La corta el esquema (`dataBase64` pide min(1)), así que es 422 y no el
    // 413 del handler: ese chequeo de byteLength === 0 ya es inalcanzable.
    expect(response.status).toBe(422);
    expect(api.state.uploaded).toEqual([]);
  });

  it('una imagen más grande que el límite tampoco', async () => {
    const api = testApi();

    const response = await api.admin('POST', ROUTES.uploads.productImage, {
      body: {
        fileName: 'enorme.png',
        contentType: 'image/png',
        dataBase64: 'A'.repeat(6 * 1024 * 1024),
      },
    });

    expect(response.status).toBe(413);
    expect(errorOf(response).message).toContain('4 MB');
    expect(api.state.uploaded).toEqual([]);
  });

  it('una imagen válida se sube y devuelve 201 con la URL', async () => {
    const api = testApi();

    const response = await api.admin('POST', ROUTES.uploads.productImage, {
      body: {
        fileName: 'campera.png',
        contentType: 'image/png',
        dataBase64: Buffer.from('una imagen').toString('base64'),
      },
    });

    expect(response.status).toBe(201);
    expect(dataOf<{ url: string }>(response).url).toContain('campera.png');
    expect(api.state.uploaded).toEqual(['campera.png']);
  });
});

describe('GET /emails/preview', () => {
  it('sin código usa el pedido de ejemplo y no manda nada', async () => {
    const api = testApi();

    const response = await api.admin('GET', ROUTES.emails.preview, {
      query: { kind: 'orderReceived' },
    });

    expect(response.status).toBe(200);
    expect(dataOf<{ isSample: boolean }>(response).isSample).toBe(true);
    expect(api.state.sent).toEqual([]);
  });

  it('con un código real previsualiza ese pedido', async () => {
    const api = testApi({ orders: [order()] });

    const response = await api.admin('GET', ROUTES.emails.preview, {
      query: { kind: 'readyForPickup', code: 'CAMG-2026-ABCDE' },
    });

    expect(dataOf<{ isSample: boolean; html: string }>(response).isSample).toBe(false);
    expect(dataOf<{ html: string }>(response).html).toContain('CAMG-2026-ABCDE');
    expect(api.state.sent).toEqual([]);
  });

  it('una plantilla que no existe es 422', async () => {
    const response = await testApi().admin('GET', ROUTES.emails.preview, {
      query: { kind: 'la-que-quiera' },
    });

    expect(response.status).toBe(422);
  });
});

describe('el router de producción', () => {
  /**
   * Los tests de arriba arman su propia API con dobles, así que no verían que
   * `makeApiRouter()` se quedó sin montar un módulo. Esto mira el objeto que
   * Vercel usa de verdad, y `resolve` no ejecuta el handler: no toca Supabase.
   */
  const TODAS = [
    ['POST', ROUTES.auth.login],
    ['GET', ROUTES.auth.session],
    ['GET', ROUTES.products.collection],
    ['POST', ROUTES.products.collection],
    ['PATCH', ROUTES.products.byId('x')],
    ['PATCH', ROUTES.products.stock('x')],
    ['DELETE', ROUTES.products.byId('x')],
    ['GET', ROUTES.promotions.collection],
    ['POST', ROUTES.promotions.collection],
    ['PATCH', ROUTES.promotions.byId('x')],
    ['DELETE', ROUTES.promotions.byId('x')],
    ['GET', ROUTES.orders.collection],
    ['POST', ROUTES.orders.collection],
    ['GET', ROUTES.orders.summary],
    ['GET', ROUTES.orders.byCode('CAMG-2026-ABCDE')],
    ['PATCH', ROUTES.orders.byCode('CAMG-2026-ABCDE')],
    ['PATCH', ROUTES.orders.items('CAMG-2026-ABCDE')],
    ['PATCH', ROUTES.orders.payment('CAMG-2026-ABCDE')],
    ['GET', ROUTES.orders.whatsapp('CAMG-2026-ABCDE')],
    ['POST', ROUTES.orders.whatsapp('CAMG-2026-ABCDE')],
    ['GET', ROUTES.orders.emails('CAMG-2026-ABCDE')],
    ['POST', ROUTES.uploads.productImage],
    ['GET', ROUTES.emails.preview],
  ] as const;

  it('tiene montados los seis módulos, con todas sus rutas', () => {
    const sinMontar = TODAS.filter(([method, path]) => {
      try {
        apiRouter.resolve({
          method,
          path,
          query: {},
          headers: {},
          body: undefined,
          ip: '127.0.0.1',
          params: {},
        });
        return false;
      } catch {
        return true;
      }
    }).map(([method, path]) => `${method} ${path}`);

    expect(sinMontar).toEqual([]);
  });
});
