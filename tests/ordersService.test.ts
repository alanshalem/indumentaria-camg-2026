import './support/serverEnv';
import { describe, expect, it } from 'vitest';
import type { Order, OrderStatus } from '../shared/domain/order';
import type { Product, ProductInput } from '../shared/domain/product';
import type { PromotionDefinition } from '../shared/domain/promotions';
import type { OrderRepository } from '../server/infra/orderRepository';
import type { ProductRepository } from '../server/infra/productRepository';
import type { PromotionRepository } from '../server/infra/promotionRepository';
import type { EmailsService } from '../server/modules/emails/emails.service';
import { createOrdersService } from '../server/modules/orders/orders.service';
import { HttpError } from '../server/http/errors';
import { emailKindForStatus, type EmailKind } from '../shared/domain/orderEmails';
import { signOrderToken } from '../server/security/orderToken';

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'campera-canguro',
  name: 'Campera Canguro CAMG',
  description: '',
  imageUrl: '/images/fotos-prendas/campera.jpg',
  sizesSmall: ['6', '8', '10', '12', '14'],
  sizesLarge: ['16/XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  priceSmall: 48500,
  priceLarge: 54000,
  colors: [],
  sizeChartId: 'buzos',
  category: 'abrigo',
  isActive: true,
  sortOrder: 0,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

const CUSTOMER = {
  customerName: 'Ana',
  customerLastName: 'Pérez',
  phone: '1123456789',
  email: 'ana@ejemplo.com',
};

/** Doble en memoria: el servicio no sabe si detrás hay Postgres o un Map. */
function fakeProducts(catalog: Product[]): ProductRepository {
  const unused = () => {
    throw new Error('no usado');
  };
  return {
    list: async () => catalog,
    findById: async (id) => catalog.find((item) => item.id === id) ?? null,
    findManyByIds: async (ids) =>
      new Map(catalog.filter((item) => ids.includes(item.id)).map((item) => [item.id, item])),
    create: unused,
    update: (_id: string, _patch: Partial<ProductInput>) => unused(),
    remove: unused,
  };
}

function fakeOrders(): OrderRepository & { saved: Order[] } {
  const saved: Order[] = [];
  return {
    saved,
    list: async () => ({ orders: saved, total: saved.length }),
    findByCode: async (code) => saved.find((order) => order.code === code) ?? null,
    create: async (order) => {
      saved.push(order);
      return order;
    },
    updateStatus: async (code: string, status: OrderStatus) => {
      const found = saved.find((order) => order.code === code)!;
      found.status = status;
      return found;
    },
  };
}

const fakePromotions = (definitions: PromotionDefinition[] = []): PromotionRepository => ({
  list: async () => definitions,
  update: async () => {
    throw new Error('no usado');
  },
});

/** Espia de mails: registra a que estado se le aviso, sin tocar la red. */
function fakeEmails(missed: EmailKind[] = []): EmailsService & { notified: OrderStatus[] } {
  const notified: OrderStatus[] = [];
  return {
    notified,
    notifyStatus: async (order) => {
      notified.push(order.status);
      const kind = emailKindForStatus(order.status);
      return kind ? { kind, status: 'sent', recipient: order.email ?? '' } : null;
    },
    missedNotices: async () => missed,
    history: async () => [],
  };
}

describe('ordersService.create', () => {
  it('cobra el precio del tier que corresponde al talle', async () => {
    const orders = fakeOrders();
    const service = createOrdersService(orders, fakeProducts([product()]), fakePromotions(), fakeEmails());

    const { order } = await service.create({
      ...CUSTOMER,
      // Un cliente malicioso podría inventar unitPrice/total: el tipo no los
      // acepta y el servicio jamás los leería.
      items: [
        { productId: 'campera-canguro', size: 'L', quantity: 1 },
        { productId: 'campera-canguro', size: '12', quantity: 1 },
      ],
    });

    expect(order.items[0]?.unitPrice).toBe(54000);
    expect(order.items[0]?.sizeTier).toBe('large');
    expect(order.items[1]?.unitPrice).toBe(48500);
    expect(order.items[1]?.sizeTier).toBe('small');
    expect(order.subtotal).toBe(102500);
    expect(order.total).toBe(102500);
    expect(order.phone).toBe('1123456789');
    expect(orders.saved).toHaveLength(1);
  });

  it('aplica las promociones activas de la base sobre precios del servidor', async () => {
    const service = createOrdersService(
      fakeOrders(),
      fakeProducts([product()]),
      fakePromotions([
        {
          id: 'familia-camg',
          kind: 'sameProductDifferentSize',
          label: 'Promo familia CAMG',
          description: '',
          config: { percentOff: 10 },
          isActive: true,
          sortOrder: 20,
        },
      ]),
      fakeEmails(),
    );

    const { order } = await service.create({
      ...CUSTOMER,
      items: [
        { productId: 'campera-canguro', size: 'L', quantity: 1 },
        { productId: 'campera-canguro', size: '12', quantity: 1 },
      ],
    });

    expect(order.subtotal).toBe(102500);
    expect(order.promotions).toHaveLength(1);
    expect(order.total).toBe(102500 - 4850); // 10% de 48500
  });

  it('rechaza un talle que el producto no tiene', async () => {
    const service = createOrdersService(fakeOrders(), fakeProducts([product()]), fakePromotions(), fakeEmails());

    await expect(
      service.create({ ...CUSTOMER, items: [{ productId: 'campera-canguro', size: '4', quantity: 1 }] }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rechaza un producto inexistente', async () => {
    const service = createOrdersService(fakeOrders(), fakeProducts([]), fakePromotions(), fakeEmails());

    await expect(
      service.create({ ...CUSTOMER, items: [{ productId: 'fantasma', size: 'M', quantity: 1 }] }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('rechaza un producto despublicado', async () => {
    const service = createOrdersService(
      fakeOrders(),
      fakeProducts([product({ isActive: false })]),
      fakePromotions(),
      fakeEmails(),
    );

    await expect(
      service.create({ ...CUSTOMER, items: [{ productId: 'campera-canguro', size: 'M', quantity: 1 }] }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('exige elegir color cuando el producto tiene variantes', async () => {
    const remera = product({
      id: 'remera-algodon',
      name: 'Remera',
      colors: [{ name: 'Roja', hex: '#DC143C', imageUrl: null }],
    });
    const service = createOrdersService(fakeOrders(), fakeProducts([remera]), fakePromotions(), fakeEmails());

    await expect(
      service.create({ ...CUSTOMER, items: [{ productId: 'remera-algodon', size: 'M', quantity: 1 }] }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    await expect(
      service.create({
        ...CUSTOMER,
        items: [{ productId: 'remera-algodon', size: 'M', color: 'Verde', quantity: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('descarta el color en productos que no tienen variantes', async () => {
    const service = createOrdersService(fakeOrders(), fakeProducts([product()]), fakePromotions(), fakeEmails());

    const { order } = await service.create({
      ...CUSTOMER,
      items: [{ productId: 'campera-canguro', size: 'M', color: 'Inventado', quantity: 1 }],
    });

    expect(order.items[0]?.color).toBeNull();
  });

  it('reintenta cuando el código generado colisiona', async () => {
    const orders = fakeOrders();
    let attempts = 0;
    const originalCreate = orders.create;
    orders.create = async (order) => {
      attempts += 1;
      if (attempts === 1) throw new HttpError('CONFLICT', 'duplicado');
      return originalCreate(order);
    };

    const service = createOrdersService(orders, fakeProducts([product()]), fakePromotions(), fakeEmails());
    const { order } = await service.create({
      ...CUSTOMER,
      items: [{ productId: 'campera-canguro', size: 'S', quantity: 1 }],
    });

    expect(attempts).toBe(2);
    expect(order.code).toMatch(/^CAMG-\d{4}-/);
  });

  it('avisa por mail al crear el pedido', async () => {
    const emails = fakeEmails();
    const service = createOrdersService(
      fakeOrders(),
      fakeProducts([product()]),
      fakePromotions(),
      emails,
    );

    await service.create({
      ...CUSTOMER,
      items: [{ productId: 'campera-canguro', size: 'M', quantity: 1 }],
    });

    expect(emails.notified).toEqual(['pending']);
  });
});

describe('ordersService.updateStatus', () => {
  it('notifica cada cambio de estado', async () => {
    const orders = fakeOrders();
    const emails = fakeEmails();
    const service = createOrdersService(orders, fakeProducts([product()]), fakePromotions(), emails);

    const { order } = await service.create({
      ...CUSTOMER,
      items: [{ productId: 'campera-canguro', size: 'M', quantity: 1 }],
    });

    await service.updateStatus(order.code, 'paid');
    await service.updateStatus(order.code, 'ready');
    await service.updateStatus(order.code, 'delivered');

    // 'delivered' tambien se notifica: es el servicio de mails el que decide
    // que ese estado no tiene plantilla y no manda nada.
    expect(emails.notified).toEqual(['pending', 'paid', 'ready', 'delivered']);
  });
});

describe('ordersService.findPublic', () => {
  const service = () =>
    createOrdersService(fakeOrders(), fakeProducts([product()]), fakePromotions(), fakeEmails());

  const newOrder = async (orders: ReturnType<typeof createOrdersService>) =>
    (await orders.create({ ...CUSTOMER, items: [{ productId: 'campera-canguro', size: 'M', quantity: 1 }] }))
      .order;

  it('devuelve el pedido cuando el token es el del link del mail', async () => {
    const orders = service();
    const created = await newOrder(orders);

    const found = await orders.findPublic(created.code, signOrderToken(created.code));

    expect(found.code).toBe(created.code);
    expect(found.status).toBe('pending');
    expect(found.items).toHaveLength(1);
    expect(found.total).toBe(created.total);
  });

  it('no expone telefono ni mail: el link se puede reenviar', async () => {
    const orders = service();
    const created = await newOrder(orders);

    const found = await orders.findPublic(created.code, signOrderToken(created.code));

    expect(found).not.toHaveProperty('phone');
    expect(found).not.toHaveProperty('email');
    expect(JSON.stringify(found)).not.toContain(CUSTOMER.phone);
  });

  it('rechaza un token invalido', async () => {
    const orders = service();
    const created = await newOrder(orders);

    await expect(orders.findPublic(created.code, 'firma-inventada')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(orders.findPublic(created.code, '')).rejects.toBeInstanceOf(HttpError);
  });

  it('rechaza el token de otro pedido', async () => {
    const orders = service();
    const created = await newOrder(orders);

    await expect(
      orders.findPublic(created.code, signOrderToken('CAMG-2026-OTROO')),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('un codigo inexistente y un token invalido fallan igual', async () => {
    const orders = service();
    const created = await newOrder(orders);
    const ghost = 'CAMG-2026-FANTA';

    // Mismo code y mismo mensaje en los dos casos: la respuesta no revela si
    // ese pedido existe, asi que el codigo no se puede enumerar desde afuera.
    const noSuchOrder = await orders.findPublic(ghost, signOrderToken(ghost)).catch((e) => e);
    const badToken = await orders.findPublic(created.code, 'firma-inventada').catch((e) => e);

    expect(noSuchOrder).toBeInstanceOf(HttpError);
    expect(badToken).toBeInstanceOf(HttpError);
    expect(noSuchOrder.code).toBe('NOT_FOUND');
    expect(badToken.code).toBe(noSuchOrder.code);
    expect(badToken.message).toBe(noSuchOrder.message);
  });
});

describe('ordersService.updateStatus · que informa', () => {
  const build = (missed: EmailKind[] = []) => {
    const emails = fakeEmails(missed);
    const service = createOrdersService(
      fakeOrders(),
      fakeProducts([product()]),
      fakePromotions(),
      emails,
    );
    return { service, emails };
  };

  const nuevo = async (service: ReturnType<typeof createOrdersService>) =>
    (await service.create({ ...CUSTOMER, items: [{ productId: 'campera-canguro', size: 'M', quantity: 1 }] }))
      .order;

  it('devuelve el pedido y el aviso que salio', async () => {
    const { service } = build();
    const created = await nuevo(service);

    const update = await service.updateStatus(created.code, 'paid');

    expect(update.order.status).toBe('paid');
    expect(update.notice).toMatchObject({ kind: 'paymentConfirmed', status: 'sent' });
    expect(update.missed).toEqual([]);
  });

  it('un estado sin aviso se distingue de un fallo: notice queda en null', async () => {
    const { service } = build();
    const created = await nuevo(service);

    const update = await service.updateStatus(created.code, 'delivered');

    expect(update.notice).toBeNull();
  });

  it('devuelve los avisos que quedaron sin mandar al saltear etapas', async () => {
    // El caso que confundio al club: marcar "Entregado" directo desde
    // "Pendiente" no manda nada, y sin esto el panel no lo dice.
    const { service } = build(['paymentConfirmed', 'readyForPickup']);
    const created = await nuevo(service);

    const update = await service.updateStatus(created.code, 'delivered');

    expect(update.missed).toEqual(['paymentConfirmed', 'readyForPickup']);
  });
});

describe('ordersService.create · token de seguimiento', () => {
  it('devuelve la firma del link junto con el pedido', async () => {
    const service = createOrdersService(
      fakeOrders(),
      fakeProducts([product()]),
      fakePromotions(),
      fakeEmails(),
    );

    const created = await service.create({
      ...CUSTOMER,
      items: [{ productId: 'campera-canguro', size: 'M', quantity: 1 }],
    });

    // Es el mismo token que viaja en el mail: sin esto el socio veia su codigo
    // en pantalla y no tenia forma de entrar al seguimiento.
    expect(created.statusToken).toBe(signOrderToken(created.order.code));
    expect(created.statusToken.length).toBeGreaterThan(20);
  });

  it('el token que devuelve abre ese pedido y ningun otro', async () => {
    const orders = fakeOrders();
    const service = createOrdersService(
      orders,
      fakeProducts([product()]),
      fakePromotions(),
      fakeEmails(),
    );

    const created = await service.create({
      ...CUSTOMER,
      items: [{ productId: 'campera-canguro', size: 'M', quantity: 1 }],
    });

    const publico = await service.findPublic(created.order.code, created.statusToken);
    expect(publico.code).toBe(created.order.code);

    await expect(
      service.findPublic('CAMG-2026-OTROO', created.statusToken),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
