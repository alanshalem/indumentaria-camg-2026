import { useState } from 'react';
import { useCartStore } from '../../store/cartStore.js';
import { addOrder, setLastOrderRef } from '../../utils/storage.js';
import { generateOrderCode } from '../../utils/generateOrderCode.js';
import { formatPrice } from '../../utils/formatters.js';
import styles from './CheckoutForm.module.css';

export default function CheckoutForm({ onBack, onComplete }) {
  const items = useCartStore(s => s.items);
  const totalPrice = useCartStore(s => s.items.reduce((a, b) => a + (b.unitPrice || 0) * b.quantity, 0));
  const clear = useCartStore(s => s.clear);

  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim() || !lastName.trim()) {
      setError('Ingresá nombre y apellido.');
      return;
    }
    if (items.length === 0) {
      setError('El carrito está vacío.');
      return;
    }
    setSubmitting(true);

    const order = {
      code: generateOrderCode(),
      timestamp: Date.now(),
      customerName: name.trim(),
      customerLastName: lastName.trim(),
      items: items.map(i => ({
        productId: i.productId,
        productName: i.productName,
        size: i.size,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
      total: totalPrice,
      status: 'pending',
    };

    addOrder(order);
    setLastOrderRef(order.code);
    clear();
    setSubmitting(false);
    onComplete(order);
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <button type="button" onClick={onBack} className={styles.back}>
        ← Volver al carrito
      </button>

      <div className={styles.summary}>
        <p className={styles.summaryLabel}>Total a pedir</p>
        <p className={styles.summaryVal}>{formatPrice(totalPrice)}</p>
        <p className={styles.summaryItems}>{items.length} producto{items.length !== 1 ? 's' : ''}</p>
      </div>

      <div className={styles.field}>
        <label htmlFor="name">Nombre *</label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          autoComplete="given-name"
          required
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="lastName">Apellido *</label>
        <input
          id="lastName"
          type="text"
          value={lastName}
          onChange={e => setLastName(e.target.value)}
          autoComplete="family-name"
          required
        />
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
        {submitting ? 'Generando…' : 'Generar pedido'}
      </button>

      <p className={styles.disclaimer}>
        Vas a recibir un código único para coordinar el retiro de tu pedido en la sede del club.
      </p>
    </form>
  );
}
