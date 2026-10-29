import { useEffect, useState } from 'react';
import { formatPrice } from '@shared/domain/money';
import { type Order } from '@shared/domain/order';
import { allSizes, priceForTier, sizeTierOf, type Product } from '@shared/domain/product';
import type { EditOrderDto } from '@shared/schemas/order.schema';
import { useAdminAction } from '@/hooks/useAdminAction';
import { catalogService } from '@/services/catalogService';
import { orderService } from '@/services/orderService';
import { Alert, Button, Spinner } from '@/ui';
import { PlusIcon, TrashIcon } from '@/ui/icons';
import styles from './EditOrderDialog.module.css';

interface Props {
  order: Order;
  onCancel: () => void;
  onSaved: (order: Order) => void;
}

interface EditableItem {
  key: string;
  productId: string;
  size: string;
  color: string | null;
  quantity: number;
  unitPrice: number;
  delivered: boolean;
}

export function EditOrderDialog({ order, onCancel, onSaved }: Props) {
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);

  const [customerName, setCustomerName] = useState(order.customerName);
  const [customerLastName, setCustomerLastName] = useState(order.customerLastName);
  const [phone, setPhone] = useState(order.phone);
  const [email, setEmail] = useState(order.email ?? '');

  const [items, setItems] = useState<EditableItem[]>(() =>
    order.items.map((item, idx) => ({
      key: `item-${idx}-${Date.now()}`,
      productId: item.productId,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      delivered: item.delivered,
    })),
  );

  const [customTotal, setCustomTotal] = useState<number | null>(null);

  const { busyId, error, run } = useAdminAction();

  useEffect(() => {
    let cancelled = false;
    catalogService
      .list({ includeInactive: true })
      .then((prods) => {
        if (!cancelled) {
          setCatalog(prods);
          setLoadingCatalog(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingCatalog(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const computedSubtotal = items.reduce(
    (sum, item) => sum + Math.max(0, item.quantity) * Math.max(0, item.unitPrice),
    0,
  );

  // Si no se sobreescribió el total a mano, se usa el subtotal calculado
  // menos eventual descuento previo (o el mismo subtotal).
  const discount = Math.max(0, order.subtotal - order.total);
  const activeTotal = customTotal !== null ? customTotal : Math.max(0, computedSubtotal - discount);

  const handleProductChange = (index: number, newProductId: string) => {
    const prod = catalog.find((p) => p.id === newProductId);
    if (!prod) return;

    const availableSizes = allSizes(prod);
    const newSize = availableSizes[0] ?? '';
    const newColor = prod.colors.length > 0 ? (prod.colors[0]?.name ?? null) : null;
    const tier = sizeTierOf(prod, newSize) ?? 'large';
    const unitPrice = priceForTier(prod, tier);

    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              productId: newProductId,
              size: newSize,
              color: newColor,
              unitPrice,
            }
          : item,
      ),
    );
  };

  const handleSizeChange = (index: number, newSize: string) => {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx !== index) return item;
        const prod = catalog.find((p) => p.id === item.productId);
        let unitPrice = item.unitPrice;
        if (prod) {
          const tier = sizeTierOf(prod, newSize) ?? 'large';
          unitPrice = priceForTier(prod, tier);
        }
        return { ...item, size: newSize, unitPrice };
      }),
    );
  };

  const handleColorChange = (index: number, newColor: string | null) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, color: newColor } : item)),
    );
  };

  const handleQuantityChange = (index: number, qty: number) => {
    const validQty = Math.max(1, isNaN(qty) ? 1 : qty);
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, quantity: validQty } : item)),
    );
  };

  const handleUnitPriceChange = (index: number, price: number) => {
    const validPrice = Math.max(0, isNaN(price) ? 0 : price);
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, unitPrice: validPrice } : item)),
    );
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleAddItem = () => {
    const firstProd = catalog[0];
    if (!firstProd) return;
    const sizes = allSizes(firstProd);
    const size = sizes[0] ?? '';
    const color = firstProd.colors.length > 0 ? (firstProd.colors[0]?.name ?? null) : null;
    const tier = sizeTierOf(firstProd, size) ?? 'large';

    setItems((prev) => [
      ...prev,
      {
        key: `item-${Date.now()}-${Math.random()}`,
        productId: firstProd.id,
        size,
        color,
        quantity: 1,
        unitPrice: priceForTier(firstProd, tier),
        delivered: false,
      },
    ]);
  };

  const handleSave = () => {
    void run(
      'save-order',
      async () => {
        const payload: EditOrderDto = {
          customerName: customerName.trim(),
          customerLastName: customerLastName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
          items: items.map((item) => ({
            productId: item.productId,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            delivered: item.delivered,
          })),
          subtotal: computedSubtotal,
          total: activeTotal,
        };

        const updated = await orderService.updateOrder(order.code, payload);
        onSaved(updated);
      },
      null,
      'No se pudo actualizar el pedido.',
    );
  };

  if (loadingCatalog) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <Spinner size={24} label="Cargando productos…" />
      </div>
    );
  }

  return (
    <div className={styles.dialog}>
      {error && <Alert>{error}</Alert>}

      {/* Datos del Socio */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Datos del comprador</h3>
        <div className={styles.customerGrid}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Nombre</label>
            <input
              type="text"
              className={styles.input}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nombre"
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Apellido</label>
            <input
              type="text"
              className={styles.input}
              value={customerLastName}
              onChange={(e) => setCustomerLastName(e.target.value)}
              placeholder="Apellido"
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Teléfono</label>
            <input
              type="text"
              className={styles.input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej: 11 3146-0477"
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Email</label>
            <input
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@ejemplo.com"
            />
          </div>
        </div>
      </section>

      {/* Artículos del pedido */}
      <section className={styles.section}>
        <div className={styles.itemCardHeader}>
          <h3 className={styles.sectionTitle} style={{ borderBottom: 'none', paddingBottom: 0 }}>
            Artículos del pedido ({items.length})
          </h3>
          <button type="button" className={styles.addBtn} onClick={handleAddItem}>
            <PlusIcon size={14} />
            <span>Agregar artículo</span>
          </button>
        </div>

        <div className={styles.itemsList}>
          {items.map((item, index) => {
            const currentProd =
              catalog.find((p) => p.id === item.productId) ??
              catalog.find((p) => p.name === item.productId);
            const sizes = currentProd ? allSizes(currentProd) : [item.size];
            const colors = currentProd?.colors ?? [];

            return (
              <div key={item.key} className={styles.itemCard}>
                <div className={styles.itemRow}>
                  {/* Producto */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Artículo</label>
                    <select
                      className={styles.select}
                      value={currentProd?.id ?? item.productId}
                      onChange={(e) => handleProductChange(index, e.target.value)}
                    >
                      {catalog.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.name} {!prod.isActive ? '(inactivo)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Talle */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Talle</label>
                    <select
                      className={styles.select}
                      value={item.size}
                      onChange={(e) => handleSizeChange(index, e.target.value)}
                    >
                      {sizes.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Color */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Color</label>
                    {colors.length > 0 ? (
                      <select
                        className={styles.select}
                        value={item.color ?? ''}
                        onChange={(e) => handleColorChange(index, e.target.value || null)}
                      >
                        {colors.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        className={styles.input}
                        value="Sin color"
                        disabled
                        style={{ opacity: 0.6 }}
                      />
                    )}
                  </div>

                  {/* Cantidad */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>Cantidad</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      className={styles.input}
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(index, parseInt(e.target.value, 10))}
                    />
                  </div>

                  {/* Precio Unitario */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} title="Precio por unidad (editable)">
                      Precio unit. ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      className={styles.input}
                      value={item.unitPrice}
                      onChange={(e) =>
                        handleUnitPriceChange(index, parseInt(e.target.value, 10))
                      }
                    />
                  </div>

                  {/* Eliminar */}
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => handleRemoveItem(index)}
                    disabled={items.length <= 1}
                    title={
                      items.length <= 1
                        ? 'El pedido debe tener al menos un artículo'
                        : 'Eliminar este artículo'
                    }
                    aria-label={`Eliminar artículo ${index + 1}`}
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>

                <div className={styles.lineTotal}>
                  Subtotal línea: {formatPrice(item.quantity * item.unitPrice)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Totales y notas */}
      <section className={styles.totalsSection}>
        <h3 className={styles.sectionTitle} style={{ borderBottom: 'none', paddingBottom: 0 }}>
          Montos e Importes
        </h3>

        <div className={styles.totalsGrid}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Subtotal calculado</label>
            <input
              type="text"
              className={styles.input}
              value={formatPrice(computedSubtotal)}
              disabled
              style={{ fontWeight: 'bold' }}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Total final a cobrar ($)</label>
            <input
              type="number"
              min={0}
              step={500}
              className={styles.input}
              value={activeTotal}
              onChange={(e) => setCustomTotal(parseInt(e.target.value, 10) || 0)}
              style={{ fontWeight: 'bold', color: 'var(--color-red-bright)' }}
            />
          </div>
        </div>

        <p className={styles.infoNote}>
          💡 Podés cambiar libremente el <strong>precio unitario</strong> de cada artículo (por
          ejemplo para dejar la mercadería al costo a los profesores) o ajustar el{' '}
          <strong>total final</strong>. Este cambio impacta en todo el sistema: reportes, resumen
          de compras para proveedores y stock.
        </p>
      </section>

      {/* Botones de acción */}
      <div className={styles.actions}>
        <Button variant="ghost" onClick={onCancel} disabled={busyId !== null}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={busyId !== null}>
          {busyId !== null ? 'Guardando cambios…' : 'Guardar cambios'}
        </Button>
      </div>
    </div>
  );
}
