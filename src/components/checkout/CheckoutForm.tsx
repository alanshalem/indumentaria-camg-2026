import { useState, type FormEvent } from 'react';
import type { Order } from '@shared/domain/order';
import type { PromotionOutcome } from '@shared/domain/promotions';
import { createOrderSchema } from '@shared/schemas/order.schema';
import { ApiError, errorMessage } from '@/services/apiError';
import { lastOrderStorage } from '@/services/lastOrderStorage';
import { orderService } from '@/services/orderService';
import { toOrderItems, useCartStore } from '@/store/cartStore';
import { Alert, Button, Field } from '@/ui';
import { CartSummary } from '@/components/cart/CartSummary';
import styles from './CheckoutForm.module.css';

interface Props {
  outcome: PromotionOutcome;
  onBack: () => void;
  onComplete: (order: Order) => void;
}

const collectIssues = (issues: readonly { path: PropertyKey[]; message: string }[]) => {
  const errors: Record<string, string> = {};
  for (const issue of issues) {
    errors[issue.path.map(String).join('.') || '_'] ??= issue.message;
  }
  return errors;
};

export function CheckoutForm({ outcome, onBack, onComplete }: Props) {
  const lines = useCartStore((state) => state.lines);
  const clear = useCartStore((state) => state.clear);

  const [customerName, setCustomerName] = useState('');
  const [customerLastName, setCustomerLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError('');
    setFieldErrors({});

    // Mismo esquema zod que usa el servidor: una sola definición de "válido".
    const parsed = createOrderSchema.safeParse({
      customerName,
      customerLastName,
      phone,
      email,
      items: toOrderItems(lines),
    });

    if (!parsed.success) {
      const errors = collectIssues(parsed.error.issues);
      setFieldErrors(errors);
      setFormError(errors['_'] ?? errors['items'] ?? 'Revisá los datos del formulario.');
      return;
    }

    setIsSubmitting(true);
    try {
      // El pedido que devuelve la API es el autoritativo: código, precios,
      // promociones y total salen de la base, no de este browser.
      const order = await orderService.create(parsed.data);
      lastOrderStorage.save(order.code);
      clear();
      onComplete(order);
    } catch (caught) {
      if (caught instanceof ApiError) setFieldErrors(caught.fields);
      setFormError(errorMessage(caught, 'No se pudo generar el pedido. Reintentá en unos segundos.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <button type="button" onClick={onBack} className={styles.back}>
        ← Volver al carrito
      </button>

      <div className={styles.summary}>
        <CartSummary outcome={outcome} compact />
        <p className={styles.summaryItems}>
          {lines.length} producto{lines.length === 1 ? '' : 's'} en el pedido
        </p>
      </div>

      <Field
        label="Nombre *"
        value={customerName}
        onChange={(event) => setCustomerName(event.target.value)}
        error={fieldErrors['customerName']}
        autoComplete="given-name"
        maxLength={60}
        required
      />

      <Field
        label="Apellido *"
        value={customerLastName}
        onChange={(event) => setCustomerLastName(event.target.value)}
        error={fieldErrors['customerLastName']}
        autoComplete="family-name"
        maxLength={60}
        required
      />

      <Field
        label="Teléfono *"
        type="tel"
        inputMode="tel"
        value={phone}
        onChange={(event) => setPhone(event.target.value)}
        error={fieldErrors['phone']}
        placeholder="11 2345-6789"
        autoComplete="tel"
        maxLength={30}
        hint="Te escribimos por acá para coordinar el pago y el retiro."
        required
      />

      <Field
        label="Email (opcional)"
        type="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        error={fieldErrors['email']}
        placeholder="socio@ejemplo.com"
        autoComplete="email"
        maxLength={120}
      />

      <Alert>{formError}</Alert>

      <Button type="submit" block loading={isSubmitting}>
        {isSubmitting ? 'Generando…' : 'Generar pedido'}
      </Button>

      <p className={styles.disclaimer}>
        La tienda genera el pedido y te da un código. Después el club te contacta para coordinar el
        pago y el retiro en la sede.
      </p>
    </form>
  );
}
