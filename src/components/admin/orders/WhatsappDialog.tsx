import { useCallback, useState } from 'react';
import { CLUB } from '@shared/domain/club';
import { customerFullName, type Order } from '@shared/domain/order';
import { formatPhone } from '@shared/domain/phone';
import {
  needsPaymentLink,
  whatsappMessage,
  whatsappMessageLink,
  WHATSAPP_TEMPLATES,
  WHATSAPP_TEMPLATE_HINTS,
  WHATSAPP_TEMPLATE_LABELS,
  type WhatsappLogRecord,
  type WhatsappTemplate,
} from '@shared/domain/whatsapp';
import { useAdminAction } from '@/hooks/useAdminAction';
import { useAsyncResource } from '@/hooks/useAsyncResource';
import { orderService } from '@/services/orderService';
import { formatDateTime } from '@/utils/formatDate';
import { Alert, Button } from '@/ui';
import styles from './WhatsappDialog.module.css';

interface Props {
  order: Order;
  /** El pedido puede cambiar acá adentro: se carga el link de pago. */
  onOrderChange: (order: Order) => void;
}

const NO_HISTORY: WhatsappLogRecord[] = [];

/**
 * Mensajes de WhatsApp al socio.
 *
 * No hay API de por medio: se abre `wa.me` con el texto ya escrito y el club
 * revisa y aprieta enviar. Por eso el historial dice "preparado" y no
 * "enviado" — es lo único que el sistema puede afirmar.
 */
export function WhatsappDialog({ order, onOrderChange }: Props) {
  const load = useCallback(() => orderService.whatsappHistory(order.code), [order.code]);
  const { data: history, set } = useAsyncResource(load, NO_HISTORY, [load]);

  const [link, setLink] = useState(order.paymentLink ?? '');
  const [preview, setPreview] = useState<WhatsappTemplate | null>(null);
  // El mismo trío ocupado/aviso/error que el resto del panel. Antes esto tenía
  // dos `try/catch` propios y su propio flag de guardado.
  const { busyId, error, run } = useAdminAction();

  /** El último envío de cada plantilla, que es lo que el club quiere saber. */
  const lastOf = (template: WhatsappTemplate) =>
    history.find((record) => record.template === template) ?? null;

  const saveLink = () =>
    void run(
      'link',
      async () =>
        onOrderChange(
          await orderService.setPayment(order.code, {
            method: order.paymentMethod ?? 'mercadopago',
            link: link.trim() || null,
          }),
        ),
      null,
      'No se pudo guardar el link.',
    );

  /**
   * El registro se hace al abrir el chat, no al enviar: es lo que el navegador
   * nos deja saber. Si falla, no se bloquea la apertura — el mensaje importa
   * más que la anotación.
   */
  function open(template: WhatsappTemplate) {
    // Se abre primero y en el mismo turno del click: si se espera al registro,
    // el navegador trata la pestaña como popup y la bloquea.
    window.open(whatsappMessageLink(template, order), '_blank', 'noopener,noreferrer');

    // El chat ya se abrió: que falle la anotación no es motivo para alarmar,
    // pero tampoco para mentir diciendo que quedó registrado.
    void run(
      template,
      async () => {
        const updated = await orderService.recordWhatsapp(order.code, template);
        set(() => updated);
      },
      null,
      'El mensaje se abrió, pero no se pudo registrar.',
    );
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.to}>
        Se abre el chat de <strong>{customerFullName(order)}</strong> ·{' '}
        {formatPhone(order.phone)}
      </p>

      <Alert>{error}</Alert>

      <div className={styles.templates}>
        {WHATSAPP_TEMPLATES.map((template) => {
          const last = lastOf(template);
          const falta = needsPaymentLink(template, order);

          return (
            <article key={template} className={styles.card}>
              <header className={styles.cardHead}>
                <div>
                  <h3 className={styles.cardTitle}>{WHATSAPP_TEMPLATE_LABELS[template]}</h3>
                  <p className={styles.cardHint}>{WHATSAPP_TEMPLATE_HINTS[template]}</p>
                </div>
                {last ? (
                  <span className={styles.sent} title="El club abrió el chat con este mensaje">
                    ✓ {formatDateTime(last.preparedAt)}
                  </span>
                ) : (
                  <span className={styles.notSent}>Sin preparar</span>
                )}
              </header>

              {template === 'paymentLink' && (
                <>
                  <div className={styles.linkRow}>
                    <input
                      type="url"
                      className={styles.linkInput}
                      value={link}
                      onChange={(event) => setLink(event.target.value)}
                      placeholder={CLUB.paymentLink}
                      aria-label="Link de cobro con el monto de este pedido"
                    />
                    <Button variant="ghost" onClick={saveLink} loading={busyId === 'link'}>
                      Guardar
                    </Button>
                  </div>

                  {/* El del club alcanza para cobrar; el del pedido es para
                      cuando se genera uno con el monto ya cargado. */}
                  <p className={styles.cardHint}>
                    {order.paymentLink
                      ? 'Este pedido tiene su propio link y es el que se manda.'
                      : 'Vacío manda el link general del club. Cargá uno sólo si generaste un cobro con el monto exacto.'}
                  </p>
                </>
              )}

              {falta && (
                <p className={styles.warn}>
                  No hay ningún link para mandar: el mensaje va a salir con un marcador en su lugar.
                </p>
              )}

              <button
                type="button"
                className={styles.previewToggle}
                onClick={() => setPreview(preview === template ? null : template)}
                aria-expanded={preview === template}
              >
                {preview === template ? 'Ocultar el mensaje' : 'Ver el mensaje'}
              </button>

              {preview === template && (
                <pre className={styles.preview}>{whatsappMessage(template, order)}</pre>
              )}

              <Button block onClick={() => open(template)} loading={busyId === template}>
                Abrir WhatsApp
              </Button>
            </article>
          );
        })}
      </div>

      <p className={styles.note}>
        Se registra cuando abrís el chat, no cuando apretás enviar: WhatsApp no le avisa nada a
        esta página.
      </p>
    </div>
  );
}
