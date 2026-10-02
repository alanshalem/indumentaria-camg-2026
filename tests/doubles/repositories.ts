import { notFound } from '../../server/http/errors';
import type { Order, OrderStatus } from '../../shared/domain/order';
import type { Product, ProductInput } from '../../shared/domain/product';
import type { PromotionDefinition } from '../../shared/domain/promotions';
import type { WhatsappLogRecord, WhatsappTemplate } from '../../shared/domain/whatsapp';
import type { EmailKind } from '../../shared/domain/orderEmails';
import type { EmailLogEntry, EmailLogRepository } from '../../server/infra/emailLogRepository';
import type { OrderPaymentInput, OrderRepository } from '../../server/infra/orderRepository';
import type { ProductRepository } from '../../server/infra/productRepository';
import type { PromotionRepository } from '../../server/infra/promotionRepository';
import type { StockRepository } from '../../server/infra/stockRepository';
import type { WhatsappLogRepository } from '../../server/infra/whatsappLogRepository';

/**
 * Dobles en memoria de cada repositorio.
 *
 * Son el único motivo por el que las interfaces de repositorio existen: el
 * servicio no sabe si detrás hay Postgres o un `Map`. Vivían repetidos en cada
 * archivo de test, y además incompletos —el de mails casteaba con
 * `as unknown as` porque sólo implementaba tres métodos—. Acá cada uno
 * implementa su interfaz entera, así el compilador avisa cuando alguien le
 * agrega un método al repositorio real.
 *
 * Cada fábrica devuelve también lo que el test necesita espiar (`saved`,
 * `records`, `consumido`), porque afirmar sobre el estado del doble es más
 * claro que contar llamadas.
 */

/** Lo que ningún caso debería alcanzar: si se llama, el test está mal armado. */
const noUsado = (): never => {
  throw new Error('no usado');
};

export function fakeProducts(catalog: Product[] = []): ProductRepository {
  return {
    // Filtra igual que el real (`.eq('is_active', true)` salvo que se pidan los
    // inactivos). El doble los devolvia siempre, asi que la lectura mixta del
    // catalogo -lo que el visitante puede ver- no estaba realmente ejercitada.
    list: async ({ includeInactive = false } = {}) =>
      includeInactive ? catalog : catalog.filter((item) => item.isActive),
    findById: async (id) => catalog.find((item) => item.id === id) ?? null,
    findManyByIds: async (ids) =>
      new Map(catalog.filter((item) => ids.includes(item.id)).map((item) => [item.id, item])),
    create: noUsado,
    update: (_id: string, _patch: Partial<ProductInput>) => noUsado(),
    setStock: noUsado,
    remove: noUsado,
  };
}

export function fakeOrders(seed: Order[] = []): OrderRepository & { saved: Order[] } {
  const saved: Order[] = [...seed];
  const find = (code: string): Order => {
    const found = saved.find((order) => order.code === code);
    if (!found) throw new Error(`el doble no tiene el pedido ${code}`);
    return found;
  };

  return {
    saved,
    list: async () => ({ orders: saved, total: saved.length }),
    summary: async () => ({
      revenue: saved.reduce((sum, order) => sum + order.total, 0),
      discounts: 0,
      open: saved.length,
      counted: saved.length,
    }),
    findByCode: async (code) => saved.find((order) => order.code === code) ?? null,
    create: async (order) => {
      saved.push(order);
      return order;
    },
    setItemDelivered: async (code: string, index: number, delivered: boolean) => {
      const found = find(code);
      // El real tira 404 cuando el indice no existe; sin esto el doble aceptaba
      // marcar una linea inexistente y devolvia el pedido sin cambios.
      if (!found.items[index]) throw notFound(`El pedido ${code} no tiene una linea ${index}.`);
      found.items = found.items.map((item, at) => (at === index ? { ...item, delivered } : item));
      return found;
    },
    setPayment: async (code: string, payment: OrderPaymentInput) => {
      const found = find(code);
      found.paymentMethod = payment.method;
      found.paymentLink = payment.link;
      return found;
    },
    updateStatus: async (code: string, status: OrderStatus) => {
      const found = find(code);
      found.status = status;
      return found;
    },
  };
}

export const fakePromotions = (definitions: PromotionDefinition[] = []): PromotionRepository => ({
  list: async () => definitions,
  create: noUsado,
  update: noUsado,
  remove: noUsado,
});

/**
 * Doble del inventario. `disponible` mapea variante → unidades; lo que no esté
 * en el mapa no se controla y se entrega normal.
 */
export function fakeStock(disponible: Record<string, number> = {}) {
  const consumido: string[] = [];
  const repository: StockRepository = {
    consume: async (items) =>
      items.map((item) => {
        const key = `${item.productId}|${item.size}|${item.color ?? ''}`;
        const stock = disponible[key];

        if (stock === undefined) {
          return { ...item, taken: item.quantity, backorder: 0, tracked: false };
        }

        const taken = Math.min(item.quantity, stock);
        disponible[key] = stock - taken;
        consumido.push(`${key}:${taken}`);
        return { ...item, taken, backorder: item.quantity - taken, tracked: true };
      }),
  };
  return { repository, consumido, disponible };
}

/**
 * Doble del registro de mails. `yaEnviados` arranca con los avisos que ese
 * pedido ya recibió, que es lo que hace a la idempotencia testeable.
 */
export function fakeEmailLog(yaEnviados: EmailKind[] = []) {
  const records: EmailLogEntry[] = [];
  const repository: EmailLogRepository = {
    sentKinds: async () => yaEnviados,
    history: async () =>
      records.map((entry) => ({
        kind: entry.kind,
        status: entry.status,
        recipient: entry.recipient,
        error: entry.error ?? null,
        at: 0,
      })),
    record: async (entry) => {
      records.push(entry);
      if (entry.status === 'sent') yaEnviados.push(entry.kind);
    },
  };
  return { repository, records };
}

export function fakeWhatsappLog(seed: WhatsappLogRecord[] = []) {
  const prepared: WhatsappLogRecord[] = [...seed];
  const repository: WhatsappLogRepository = {
    history: async () => prepared,
    record: async (_code: string, template: WhatsappTemplate) => {
      // Se guarda cada vez, igual que el real: que el club haya reenviado el
      // link tres veces es justamente lo que quiere ver.
      prepared.unshift({ template, preparedAt: Date.now() });
    },
  };
  return { repository, prepared };
}
