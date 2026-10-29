import { randomInt } from 'node:crypto';
import {
  computeSubtotal,
  toPublicOrder,
  type CreateOrderInput,
  type Order,
  type OrderItem,
  type OrderStatus,
  type PublicOrder,
} from '../../../shared/domain/order.js';
import type {
  OrderCreated,
  OrderPage,
  OrderStatusUpdate,
  OrderTotals,
} from '../../../shared/api/contracts.js';
import { generateOrderCode } from '../../../shared/domain/orderCode.js';
import { priceForTier, sizeTierOf, type Product } from '../../../shared/domain/product.js';
import { evaluatePromotions, expandUnits, type PricedUnit } from '../../../shared/domain/promotions.js';
import type { EditOrderDto, OrderQueryDto } from '../../../shared/schemas/order.schema.js';
import { conflict, internalError, isHttpError, notFound, validationError } from '../../http/errors.js';
import { signOrderToken, verifyOrderToken } from '../../security/orderToken.js';
import { orderRepository, type OrderRepository } from '../../infra/orderRepository.js';
import { productRepository, type ProductRepository } from '../../infra/productRepository.js';
import { promotionRepository, type PromotionRepository } from '../../infra/promotionRepository.js';
import { stockRepository, type StockRepository, type StockRequest } from '../../infra/stockRepository.js';
import {
  whatsappLogRepository,
  type WhatsappLogRecord,
  type WhatsappLogRepository,
} from '../../infra/whatsappLogRepository.js';
import type { WhatsappTemplate } from '../../../shared/domain/whatsapp.js';
import type { OrderPaymentDto } from '../../../shared/schemas/order.schema.js';
import { emailsService, type EmailsService } from '../emails/emails.service.js';

const CODE_ATTEMPTS = 5;

/** CSPRNG: los códigos de pedido son identificadores públicos, no deben ser adivinables. */
const cryptoRandomInts = (count: number, max: number): number[] =>
  Array.from({ length: count }, () => randomInt(max));

export interface OrdersService {
  list(filters: OrderQueryDto): Promise<OrderPage>;
  summary(filters: OrderQueryDto): Promise<OrderTotals>;
  /** Seguimiento público: sólo lo abre quien tiene el link firmado del mail. */
  findPublic(code: string, token: string): Promise<PublicOrder>;
  create(input: CreateOrderInput): Promise<OrderCreated>;
  updateStatus(code: string, status: OrderStatus): Promise<OrderStatusUpdate>;
  /** Control interno: marca una prenda como entregada sin avisarle al socio. */
  setItemDelivered(code: string, index: number, delivered: boolean): Promise<Order>;
  setPayment(code: string, payment: OrderPaymentDto): Promise<Order>;
  /** Registra que se preparó un mensaje y devuelve el historial actualizado. */
  recordWhatsapp(code: string, template: WhatsappTemplate): Promise<WhatsappLogRecord[]>;
  whatsappHistory(code: string): Promise<WhatsappLogRecord[]>;
  /** Edición manual del pedido por parte del administrador. */
  updateOrder(code: string, input: EditOrderDto): Promise<Order>;
}

export function createOrdersService(
  orders: OrderRepository = orderRepository,
  products: ProductRepository = productRepository,
  promotions: PromotionRepository = promotionRepository,
  emails: EmailsService = emailsService,
  stock: StockRepository = stockRepository,
  whatsapp: WhatsappLogRepository = whatsappLogRepository,
): OrdersService {
  return {
    list: (filters) => orders.list(filters),

    summary: (filters) => orders.summary(filters),

    async findPublic(code, token) {
      // Un token inválido devuelve 404, no 401: así la respuesta no confirma
      // si ese código de pedido existe.
      if (!verifyOrderToken(code, token)) throw notFound('No encontramos ese pedido.');

      const order = await orders.findByCode(code);
      if (!order) throw notFound('No encontramos ese pedido.');

      return toPublicOrder(order);
    },

    async create(input) {
      const priced = await priceItems(input, products);

      // Antes del bucle de reintentos: si el código colisiona y se reintenta,
      // el stock ya se descontó y no se vuelve a tocar.
      const items = await applyStock(priced, stock);

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
          // Lo eligió el socio en el checkout; el club lo puede corregir.
          paymentMethod: input.paymentMethod,
          // El del club alcanza para cobrar: sólo se carga uno propio cuando se
          // genera un cobro con el monto exacto.
          paymentLink: null,
        };
        try {
          const saved = await orders.create(order);
          await emails.notifyStatus(saved);

          return { order: saved, statusToken: signOrderToken(saved.code) };
        } catch (error) {
          if (!isHttpError(error) || error.code !== 'CONFLICT') {
            await stock.restore(toRestorable(items));
            throw error;
          }
        }
      }
      await stock.restore(toRestorable(items));
      throw internalError('No se pudo generar un código de pedido único. Reintentá.');
    },

    // Deliberadamente no llama a `emails.notifyStatus`: marcar una prenda es
    // control interno del club. El socio se entera cuando el pedido entero
    // pasa a "Entregado", que es el único momento en que le cambia algo.
    setItemDelivered: (code, index, delivered) =>
      orders.setItemDelivered(code, index, delivered),

    setPayment: (code, payment) => orders.setPayment(code, payment),

    async recordWhatsapp(code, template) {
      await whatsapp.record(code, template);
      return whatsapp.history(code);
    },

    whatsappHistory: (code) => whatsapp.history(code),

    async updateStatus(code, status) {
      const existing = await orders.findByCode(code);
      if (!existing) throw notFound(`No existe el pedido ${code}.`);

      if (existing.status !== status) {
        if (status === 'cancelled') {
          // Si el pedido se elimina, restaurar las unidades físicas que tenía tomadas
          const toRestore = toRestorable(existing.items);
          if (toRestore.length > 0) {
            await stock.restore(toRestore);
          }
        } else if (existing.status === 'cancelled') {
          // Si se recupera un pedido eliminado, re-consumir el stock
          const toConsume = toRestorable(existing.items);
          if (toConsume.length > 0) {
            const reConsumed = await stock.consume(toConsume);
            const updatedItems = existing.items.map((item, idx) => ({
              ...item,
              backorderedUnits: reConsumed[idx]?.backorder ?? 0,
            }));
            await orders.updateOrder(code, { items: updatedItems as any });
          }
        }
      }

      const order = await orders.updateStatus(code, status);
      const notice = await emails.notifyStatus(order);
      const missed = await emails.missedNotices(order);

      return { order, notice, missed };
    },

    async updateOrder(code, input) {
      const existing = await orders.findByCode(code);
      if (!existing) throw notFound(`No existe el pedido ${code}.`);

      // 1. Restaurar las unidades físicas que se habían descontado en el pedido anterior.
      const toRestore = toRestorable(existing.items);
      if (toRestore.length > 0) {
        await stock.restore(toRestore);
      }

      let itemsWithStock: OrderItem[] = [];
      try {
        // 2. Resolver productos y talles para los nuevos items.
      const productIds = [...new Set(input.items.map((i) => i.productId))];
      const catalog = await products.findManyByIds(productIds);

      const priced: OrderItem[] = input.items.map((item, index) => {
        const product = catalog.get(item.productId);
        const at = `items.${index}`;

        if (!product) {
          throw validationError(`El producto "${item.productId}" no existe.`, {
            [at]: 'Producto inexistente',
          });
        }

        const tier = sizeTierOf(product, item.size);
        if (!tier) {
          throw validationError(`El talle ${item.size} no existe para "${product.name}".`, {
            [at]: 'Talle inválido',
          });
        }

        const color = resolveColor(product, item.color ?? null, at);
        // Si el admin asignó un precio unitario (ej. al costo para profesores), se respeta ese;
        // de lo contrario se usa el del catálogo según tier.
        const unitPrice = item.unitPrice !== undefined ? item.unitPrice : priceForTier(product, tier);

        return {
          productId: product.id,
          productName: product.name,
          size: item.size,
          sizeTier: tier,
          color,
          quantity: item.quantity,
          unitPrice,
          backorderedUnits: 0,
          delivered: item.delivered ?? false,
        };
      });

      // 3. Descontar el stock según las nuevas variantes y cantidades.
      itemsWithStock = await applyStock(priced, stock);

      // 4. Calcular subtotal y total respetando montos explícitos si fueron ingresados.
      const computedSubtotal = computeSubtotal(itemsWithStock);
      const subtotal = input.subtotal !== undefined ? input.subtotal : computedSubtotal;
      const total = input.total !== undefined ? input.total : subtotal;

      // 5. Persistir en la base y devolver el pedido actualizado.
      return await orders.updateOrder(code, {
        items: itemsWithStock,
        subtotal,
        total,
        ...(input.customerName !== undefined ? { customer_name: input.customerName } : {}),
        ...(input.customerLastName !== undefined ? { customer_last_name: input.customerLastName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
      });
      } catch (error) {
        // Compensación atómica:
        // Si se alcanzaron a tomar unidades nuevas, devolverlas al stock físico
        const newlyConsumed = toRestorable(itemsWithStock);
        if (newlyConsumed.length > 0) {
          await stock.restore(newlyConsumed);
        }
        // Re-consumir el stock del pedido original para dejar el inventario como estaba
        if (toRestore.length > 0) {
          await stock.consume(toRestore);
        }
        throw error;
      }
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
      // Lo resuelve el descuento de stock, que corre después de tener los
      // precios: hasta entonces no se sabe qué había físicamente.
      backorderedUnits: 0,
      delivered: false,
    };
  });
}

/**
 * Descuenta el stock y marca en cada línea cuánto sale a pedido.
 *
 * El stock no bloquea la venta: cuando no alcanza, la línea se completa igual y
 * queda registrado el faltante. Devolver el pedido con el faltante marcado es
 * lo que después hace que el socio vea el plazo en el mail y el club lo vea en
 * la tabla.
 */
async function applyStock(items: OrderItem[], stock: StockRepository): Promise<OrderItem[]> {
  const outcomes = await stock.consume(
    items.map((item) => ({
      productId: item.productId,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
    })),
  );

  // Las respuestas vuelven en el mismo orden en que se pidieron: la función de
  // Postgres recorre el array de entrada.
  return items.map((item, index) => ({
    ...item,
    backorderedUnits: outcomes[index]?.backorder ?? 0,
  }));
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


/** Extrae las unidades físicas reales que fueron tomadas del stock para una lista de líneas. */
function toRestorable(items: readonly OrderItem[]): StockRequest[] {
  const result: StockRequest[] = [];
  for (const line of items) {
    const taken = Math.max(0, line.quantity - (line.backorderedUnits ?? 0));
    if (taken > 0) {
      result.push({
        productId: line.productId,
        size: line.size,
        color: line.color,
        quantity: taken,
      });
    }
  }
  return result;
}
