import { randomInt } from 'node:crypto';
import {
  toPublicOrder,
  type CreateOrderInput,
  type Order,
  type OrderItem,
  type OrderStatus,
  type PublicOrder,
} from '../../../shared/domain/order.js';
import type { OrderCreated, OrderPage, OrderStatusUpdate } from '../../../shared/api/contracts.js';
import { generateOrderCode } from '../../../shared/domain/orderCode.js';
import { priceForTier, sizeTierOf, type Product } from '../../../shared/domain/product.js';
import { evaluatePromotions, expandUnits, type PricedUnit } from '../../../shared/domain/promotions.js';
import type { OrderQueryDto } from '../../../shared/schemas/order.schema.js';
import { conflict, internalError, isHttpError, notFound, validationError } from '../../http/errors.js';
import { signOrderToken, verifyOrderToken } from '../../security/orderToken.js';
import { orderRepository, type OrderRepository } from '../../infra/orderRepository.js';
import { productRepository, type ProductRepository } from '../../infra/productRepository.js';
import { promotionRepository, type PromotionRepository } from '../../infra/promotionRepository.js';
import { emailsService, type EmailsService } from '../emails/emails.service.js';

const CODE_ATTEMPTS = 5;

/** CSPRNG: los códigos de pedido son identificadores públicos, no deben ser adivinables. */
const cryptoRandomInts = (count: number, max: number): number[] =>
  Array.from({ length: count }, () => randomInt(max));

export interface OrdersService {
  list(filters: OrderQueryDto): Promise<OrderPage>;
  /** Seguimiento público: sólo lo abre quien tiene el link firmado del mail. */
  findPublic(code: string, token: string): Promise<PublicOrder>;
  create(input: CreateOrderInput): Promise<OrderCreated>;
  updateStatus(code: string, status: OrderStatus): Promise<OrderStatusUpdate>;
}

export function createOrdersService(
  orders: OrderRepository = orderRepository,
  products: ProductRepository = productRepository,
  promotions: PromotionRepository = promotionRepository,
  emails: EmailsService = emailsService,
): OrdersService {
  return {
    list: (filters) => orders.list(filters),

    async findPublic(code, token) {
      // Un token inválido devuelve 404, no 401: así la respuesta no confirma
      // si ese código de pedido existe.
      if (!verifyOrderToken(code, token)) throw notFound('No encontramos ese pedido.');

      const order = await orders.findByCode(code);
      if (!order) throw notFound('No encontramos ese pedido.');

      return toPublicOrder(order);
    },

    async create(input) {
      const items = await priceItems(input, products);

      // Las promos se evalúan sobre precios ya resueltos por el servidor, con
      // las definiciones activas de la base: el cliente no puede inventarlas.
      const outcome = evaluatePromotions(toUnits(items), await promotions.list());

      // El código se genera del lado del servidor y se reintenta ante colisión:
      // la unicidad la garantiza el índice de la base, no el azar.
      const year = new Date().getFullYear();
      for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt += 1) {
        const order: Order = {
          code: generateOrderCode(year, cryptoRandomInts),
          timestamp: Date.now(),
          customerName: input.customerName,
          customerLastName: input.customerLastName,
          phone: input.phone,
          email: input.email ?? null,
          items,
          subtotal: outcome.subtotal,
          promotions: outcome.discounts,
          total: outcome.total,
          status: 'pending',
        };
        try {
          const saved = await orders.create(order);
          // El pedido ya está guardado: el aviso es un efecto posterior que
          // nunca puede hacer fallar el checkout.
          await emails.notifyStatus(saved);

          // El mismo token que va en el mail. Se lo damos a quien acaba de
          // generar el pedido para que el navegador pueda guardarlo y volver
          // al seguimiento sin depender de encontrar el mail.
          return { order: saved, statusToken: signOrderToken(saved.code) };
        } catch (error) {
          if (!isHttpError(error) || error.code !== 'CONFLICT') throw error;
        }
      }
      throw internalError('No se pudo generar un código de pedido único. Reintentá.');
    },

    async updateStatus(code, status) {
      const order = await orders.updateStatus(code, status);
      const notice = await emails.notifyStatus(order);

      // Lo que el socio nunca recibió. Saltear etapas —marcar "Entregado" sin
      // pasar por "Pago confirmado"— deja esos avisos sin mandar para siempre;
      // devolverlos es la única forma de que el panel lo pueda decir.
      const missed = await emails.missedNotices(order);

      return { order, notice, missed };
    },
  };
}

const toUnits = (items: readonly OrderItem[]): PricedUnit[] =>
  expandUnits(items, (item, index) => ({
    lineKey: `${index}`,
    productId: item.productId,
    productName: item.productName,
    size: item.size,
    tier: item.sizeTier,
    unitPrice: item.unitPrice,
  }));

/**
 * Corazón de la corrección del sistema: el precio, el nombre y el tier SIEMPRE
 * salen de la base, nunca del cuerpo del request. Antes el browser mandaba
 * `unitPrice` y `total`, así que cualquiera podía pedir una campera a $1.
 */
async function priceItems(input: CreateOrderInput, products: ProductRepository): Promise<OrderItem[]> {
  const ids = [...new Set(input.items.map((item) => item.productId))];
  const catalog = await products.findManyByIds(ids);

  return input.items.map((item, index) => {
    const product = catalog.get(item.productId);
    const at = `items.${index}`;

    if (!product) {
      throw validationError(`El producto "${item.productId}" ya no está disponible.`, {
        [at]: 'Producto inexistente',
      });
    }
    if (!product.isActive) {
      throw conflict(`"${product.name}" ya no está disponible.`);
    }

    const tier = sizeTierOf(product, item.size);
    if (!tier) {
      throw validationError(`El talle ${item.size} no existe para "${product.name}".`, {
        [at]: 'Talle inválido',
      });
    }

    const color = resolveColor(product, item.color ?? null, at);

    return {
      productId: product.id,
      productName: product.name,
      size: item.size,
      sizeTier: tier,
      color,
      quantity: item.quantity,
      // Snapshot inmutable: si mañana sube el precio, el pedido viejo no cambia.
      unitPrice: priceForTier(product, tier),
    };
  });
}

/** Un producto con colores exige elegir uno; uno sin colores no admite ninguno. */
function resolveColor(product: Product, requested: string | null, at: string): string | null {
  if (product.colors.length === 0) return null;

  if (!requested) {
    throw validationError(`Elegí un color para "${product.name}".`, { [at]: 'Falta el color' });
  }
  if (!product.colors.some((color) => color.name === requested)) {
    throw validationError(`El color ${requested} no existe para "${product.name}".`, {
      [at]: 'Color inválido',
    });
  }
  return requested;
}

export const ordersService = createOrdersService();
