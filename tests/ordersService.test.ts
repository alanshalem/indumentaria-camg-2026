import { describe, expect, it } from 'vitest';
import type { Order, OrderStatus } from '../shared/domain/order';
import type { Product, ProductInput } from '../shared/domain/product';
import type { PromotionDefinition } from '../shared/domain/promotions';
import type { OrderRepository } from '../server/infra/orderRepository';
import type { ProductRepository } from '../server/infra/productRepository';
import type { PromotionRepository } from '../server/infra/promotionRepository';
import { createOrdersService } from '../server/modules/orders/orders.service';
import { HttpError } from '../server/http/errors';

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
    list: async () => saved,
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

describe('ordersService.create', () => {
  it('cobra el precio del tier que corresponde al talle', async () => {
    const orders = fakeOrders();
    const service = createOrdersService(orders, fakeProducts([product()]), fakePromotions());

    const order = await service.create({
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
    );

    const order = await service.create({
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
    const service = createOrdersService(fakeOrders(), fakeProducts([product()]), fakePromotions());

    await expect(
      service.create({ ...CUSTOMER, items: [{ productId: 'campera-canguro', size: '4', quantity: 1 }] }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('rechaza un producto inexistente', async () => {
    const service = createOrdersService(fakeOrders(), fakeProducts([]), fakePromotions());

    await expect(
      service.create({ ...CUSTOMER, items: [{ productId: 'fantasma', size: 'M', quantity: 1 }] }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it('rechaza un producto despublicado', async () => {
    const service = createOrdersService(
      fakeOrders(),
      fakeProducts([product({ isActive: false })]),
      fakePromotions(),
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
    const service = createOrdersService(fakeOrders(), fakeProducts([remera]), fakePromotions());

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
    const service = createOrdersService(fakeOrders(), fakeProducts([product()]), fakePromotions());

    const order = await service.create({
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

    const service = createOrdersService(orders, fakeProducts([product()]), fakePromotions());
    const order = await service.create({
      ...CUSTOMER,
      items: [{ productId: 'campera-canguro', size: 'S', quantity: 1 }],
    });

    expect(attempts).toBe(2);
    expect(order.code).toMatch(/^CAMG-\d{4}-/);
  });
});
