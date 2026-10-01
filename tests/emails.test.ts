import './support/serverEnv';
import { describe, expect, it } from 'vitest';
import type { EmailConfig } from '../server/config/env';
import { CLUB, missingClubInfo, type ClubInfo } from '../shared/domain/club';
import type { Order } from '../shared/domain/order';
import {
  EMAIL_KINDS,
  emailKindForStatus,
  missedNoticeKinds,
  type EmailKind,
} from '../shared/domain/orderEmails';
import { escapeHtml } from '../server/modules/emails/templates/layout';
import { renderOrderEmail } from '../server/modules/emails/templates/index';
import { createEmailsService } from '../server/modules/emails/emails.service';
import type { EmailLogEntry, EmailLogRepository } from '../server/infra/emailLogRepository';
import type { EmailMessage, EmailTransport, SendResult } from '../server/infra/emailTransport';

const club: ClubInfo = {
  ...CLUB,
  paymentAlias: 'camg.club.mp',
  pickupAddress: 'Av. Siempre Viva 123, Monte Grande',
  pickupHours: ['Lunes a viernes de 18 a 21', 'Sábados de 10 a 13'],
  contactPhone: '11 2345-6789',
};

const EMAIL: EmailConfig = {
  apiKey: 'test',
  from: 'CAMG <pedidos@camg.test>',
  replyTo: null,
  siteUrl: 'https://camg.test',
};

const order = (overrides: Partial<Order> = {}): Order => ({
  code: 'CAMG-2026-ABCDE',
  timestamp: Date.UTC(2026, 7, 22, 15, 0, 0),
  customerName: 'Ana María',
  customerLastName: 'Pérez',
  phone: '1123456789',
  email: 'ana@ejemplo.com',
  items: [
    {
      productId: 'campera-canguro',
      productName: 'Campera Canguro CAMG',
      size: 'M',
      sizeTier: 'large',
      color: null,
      quantity: 2,
      unitPrice: 54000,
      backorderedUnits: 0,
      delivered: false,
    },
    {
      productId: 'remera-algodon',
      productName: 'Remera de algodón',
      size: '12',
      sizeTier: 'small',
      color: 'Roja',
      quantity: 1,
      unitPrice: 20500,
      backorderedUnits: 0,
      delivered: false,
    },
  ],
  subtotal: 128500,
  promotions: [
    {
      id: 'familia-camg',
      kind: 'sameProductDifferentSize',
      label: 'Promo familia CAMG',
      detail: 'Remera: talles 12 y M',
      amount: 2050,
    },
  ],
  total: 126450,
  status: 'pending',
  paymentMethod: null,
  paymentLink: null,
  ...overrides,
});

// ---------------------------------------------------------------------------

describe('datos del club', () => {
  it('detecta cuales faltan cargar', () => {
    const vacio = { ...CLUB, paymentAlias: '', pickupAddress: '', pickupHours: [], contactPhone: '' };
    expect(missingClubInfo(vacio)).toEqual([
      'alias de pago',
      'dirección de retiro',
      'horarios de retiro',
      'teléfono de contacto',
    ]);
  });

  it('con todo cargado no reporta faltantes', () => {
    expect(missingClubInfo(club)).toEqual([]);
  });

  it('ignora los que son solo espacios', () => {
    expect(missingClubInfo({ ...club, paymentAlias: '   ' })).toEqual(['alias de pago']);
  });
});

describe('escapeHtml', () => {
  it('neutraliza el markup que pueda venir de lo que tipeó el socio', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });

  it('escapa comillas simples y ampersands', () => {
    expect(escapeHtml("Tom & Jerry's")).toBe('Tom &amp; Jerry&#39;s');
  });
});

describe('plantillas de mail', () => {
  const context = { order: order(), club, email: EMAIL };

  it('hay una plantilla por cada tipo de aviso', () => {
    for (const kind of EMAIL_KINDS) {
      expect(() => renderOrderEmail(kind, context)).not.toThrow();
    }
  });

  it('cada plantilla trae asunto, html y texto plano', () => {
    for (const kind of EMAIL_KINDS) {
      const rendered = renderOrderEmail(kind, context);
      expect(rendered.subject.length).toBeGreaterThan(10);
      expect(rendered.html).toContain('<!doctype html>');
      expect(rendered.text.length).toBeGreaterThan(40);
      // El texto plano no debe tener markup: es el fallback.
      expect(rendered.text).not.toContain('<table');
    }
  });

  it('todas incluyen el código, el nombre y el detalle del pedido', () => {
    for (const kind of EMAIL_KINDS) {
      const { html, text } = renderOrderEmail(kind, context);

      for (const output of [html, text]) {
        expect(output).toContain('CAMG-2026-ABCDE');
        expect(output).toContain('Ana');
        expect(output).toContain('Campera Canguro CAMG');
      }
    }
  });

  it('todas dicen donde y cuando se retira', () => {
    for (const kind of EMAIL_KINDS) {
      const { html, text } = renderOrderEmail(kind, context);

      for (const output of [html, text]) {
        expect(output).toContain(club.pickupAddress);
        // Las dos ventanas horarias, no solo la primera.
        for (const franja of club.pickupHours) expect(output).toContain(franja);
      }
    }
  });

  it('omite el dato que el club todavia no cargo, sin dejar la etiqueta suelta', () => {
    const sinTelefono = { ...context, club: { ...club, contactPhone: '' } };

    for (const kind of EMAIL_KINDS) {
      const { html, text } = renderOrderEmail(kind, sinTelefono);

      // La etiqueta sin valor es peor que no mostrar nada: parece un mail roto.
      expect(html).not.toContain('Consultas');
      expect(text).not.toContain('Consultas');
      // El resto del recuadro sigue en pie.
      expect(html).toContain(club.pickupAddress);
    }
  });

  it('el texto plano separa los bloques con renglones en blanco', () => {
    for (const kind of EMAIL_KINDS) {
      const { text } = renderOrderEmail(kind, context);

      // Sin separadores el mail queda como un parrafo unico e ilegible.
      expect(text).toMatch(/\n\n/);
      // Y nunca tres saltos seguidos, que es el hueco que deja un bloque vacio.
      expect(text).not.toMatch(/\n\n\n/);
      expect(text.startsWith('\n')).toBe(false);
      expect(text.endsWith('\n')).toBe(false);
    }
  });

  it('todas linkean el seguimiento firmado, en html y en texto plano', () => {
    for (const kind of EMAIL_KINDS) {
      const { html, text } = renderOrderEmail(kind, context);
      const link = `${EMAIL.siteUrl}/pedido/${context.order.code}?t=`;

      // El texto plano tambien: hay clientes que no muestran el html y el socio
      // se quedaria sin forma de ver en que anda su pedido.
      expect(html).toContain(link);
      expect(text).toContain(link);
      expect(html).toContain('Ver el estado de mi pedido');
    }
  });

  it('muestra el total con el descuento ya aplicado', () => {
    const { html } = renderOrderEmail('orderReceived', context);
    // 126.450 es el total; 128.500 el subtotal. Los dos tienen que aparecer
    // para que el socio entienda de dónde sale la diferencia.
    expect(html).toContain('126.450');
    expect(html).toContain('128.500');
    expect(html).toContain('Promo familia CAMG');
  });

  it('el pie avisa que no se responda y remite al WhatsApp', () => {
    // Los mails salen de una direccion sin buzon: una respuesta rebota. El pie
    // NO puede invitar a responder.
    for (const kind of EMAIL_KINDS) {
      const { html } = renderOrderEmail(kind, context);
      expect(html).toContain('no respondas a esta dirección');
      expect(html).not.toContain('respondelo y te contestamos');
    }
  });

  it('usa el logo del sitio configurado', () => {
    const { html } = renderOrderEmail('orderReceived', context);
    expect(html).toContain('https://camg.test/images/logo-camg-email.png');
  });

  it('el mail de pedido recibido explica cómo pagar cuando hay alias', () => {
    const { html, text } = renderOrderEmail('orderReceived', context);
    expect(html).toContain('camg.club.mp');
    expect(text).toContain('camg.club.mp');
  });

  it('sin alias cargado no inventa datos de pago', () => {
    const sinAlias = { ...context, club: { ...club, paymentAlias: '' } };
    const { html } = renderOrderEmail('orderReceived', sinAlias);

    expect(html).not.toContain('Cómo pagar');
    expect(html).toContain('WhatsApp');
  });

  it('el de retiro trae dirección y horarios', () => {
    const { html } = renderOrderEmail('readyForPickup', context);
    expect(html).toContain('Av. Siempre Viva 123');
    expect(html).toContain('Lunes a viernes de 18 a 21');
  });

  it('escapa el nombre del socio en el html', () => {
    // Sin espacios: asi el payload entero pasa por firstName().
    const malicioso = order({ customerName: '<script>alert(1)</script>' });
    const { html } = renderOrderEmail('orderReceived', {
      order: malicioso,
      club,
      email: EMAIL,
    });

    expect(html).not.toContain('<script>alert(1)');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('no escapa dos veces: un nombre con & se lee normal', () => {
    // Regresion: heading() escapa por dentro. Si la plantilla escapaba antes,
    // "Tom & Jerry" llegaba al socio como "Tom &amp; Jerry".
    const { html } = renderOrderEmail('orderReceived', {
      order: order({ customerName: 'Tom&Jerry' }),
      club,
      email: EMAIL,
    });

    expect(html).toContain('Tom&amp;Jerry');
    expect(html).not.toContain('Tom&amp;amp;Jerry');
  });

  it('escapa tambien los nombres de producto y los colores', () => {
    // Vienen del catalogo, que carga un admin: no son de confianza ciega.
    const malicioso = order({
      items: [
        {
          productId: 'x',
          productName: '<b>Campera</b>',
          size: 'M',
          sizeTier: 'large',
          color: '"><script>',
          quantity: 1,
          unitPrice: 1000,
          backorderedUnits: 0,
          delivered: false,
        },
      ],
      promotions: [],
    });
    const { html } = renderOrderEmail('paymentConfirmed', {
      order: malicioso,
      club,
      email: EMAIL,
    });

    expect(html).not.toContain('<b>Campera</b>');
    expect(html).toContain('&lt;b&gt;Campera&lt;/b&gt;');
    expect(html).not.toContain('"><script>');
  });
});

// ---------------------------------------------------------------------------

function fakeTransport(result: SendResult = { status: 'sent', providerId: 're_1' }) {
  const sent: EmailMessage[] = [];
  const transport: EmailTransport = {
    send: async (message) => {
      sent.push(message);
      return result;
    },
  };
  return { transport, sent };
}

function fakeLog(yaEnviados: EmailKind[] = []) {
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

describe('emailsService', () => {
  it('manda el aviso que corresponde al estado', async () => {
    const { transport, sent } = fakeTransport();
    const { repository, records } = fakeLog();

    await createEmailsService(transport, repository).notifyStatus(order({ status: 'ready' }));

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('ana@ejemplo.com');
    expect(sent[0]?.subject).toContain('listo para retirar');
    expect(records[0]).toMatchObject({ kind: 'readyForPickup', status: 'sent' });
  });

  it('no manda nada cuando el estado no tiene aviso', async () => {
    const { transport, sent } = fakeTransport();
    const { repository } = fakeLog();

    await createEmailsService(transport, repository).notifyStatus(order({ status: 'delivered' }));

    expect(emailKindForStatus('delivered')).toBeNull();
    expect(sent).toHaveLength(0);
  });

  it('no repite un aviso ya enviado', async () => {
    const { transport, sent } = fakeTransport();
    const { repository } = fakeLog(['paymentConfirmed']);

    await createEmailsService(transport, repository).notifyStatus(order({ status: 'paid' }));

    expect(sent).toHaveLength(0);
  });

  it('registra el pedido sin email en vez de intentar enviarlo', async () => {
    const { transport, sent } = fakeTransport();
    const { repository, records } = fakeLog();

    await createEmailsService(transport, repository).notifyStatus(order({ email: null }));

    expect(sent).toHaveLength(0);
    expect(records[0]).toMatchObject({ status: 'skipped' });
  });

  it('un fallo del proveedor queda registrado y no se propaga', async () => {
    const { transport } = fakeTransport({ status: 'failed', error: 'Resend respondió 500.' });
    const { repository, records } = fakeLog();

    const notice = await createEmailsService(transport, repository).notifyStatus(order());

    expect(records[0]).toMatchObject({ status: 'failed', error: 'Resend respondió 500.' });
    // El panel necesita el motivo: sin esto el admin ve "no pasó nada".
    expect(notice).toMatchObject({ status: 'failed', reason: 'Resend respondió 500.' });
  });

  it('un error inesperado del repositorio tampoco tumba la operación', async () => {
    const { transport } = fakeTransport();
    const roto: EmailLogRepository = {
      sentKinds: async () => {
        throw new Error('base caída');
      },
      history: async () => [],
      record: async () => {},
    };

    const notice = await createEmailsService(transport, roto).notifyStatus(order());

    expect(notice).toMatchObject({ status: 'failed', reason: 'base caída' });
  });
});

describe('que se le aviso al socio', () => {
  it('notifyStatus devuelve el aviso que salio', async () => {
    const { transport } = fakeTransport();
    const { repository } = fakeLog();

    const notice = await createEmailsService(transport, repository).notifyStatus(
      order({ status: 'paid' }),
    );

    expect(notice).toEqual({
      kind: 'paymentConfirmed',
      status: 'sent',
      recipient: 'ana@ejemplo.com',
    });
  });

  it('avisa que ya se habia mandado en vez de callarse', async () => {
    const { transport, sent } = fakeTransport();
    const { repository } = fakeLog(['paymentConfirmed']);

    const notice = await createEmailsService(transport, repository).notifyStatus(
      order({ status: 'paid' }),
    );

    expect(sent).toHaveLength(0);
    expect(notice).toMatchObject({ status: 'already', kind: 'paymentConfirmed' });
  });

  it('un estado sin aviso devuelve null, que no es lo mismo que un fallo', async () => {
    const { transport } = fakeTransport();
    const { repository } = fakeLog();

    const notice = await createEmailsService(transport, repository).notifyStatus(
      order({ status: 'delivered' }),
    );

    expect(notice).toBeNull();
  });

  it('missedNotices lista los avisos de etapas ya pasadas que nunca salieron', async () => {
    const { transport } = fakeTransport();
    // Caso real: el admin marco "Entregado" directo desde "Pendiente".
    const { repository } = fakeLog(['orderReceived']);

    const missed = await createEmailsService(transport, repository).missedNotices(
      order({ status: 'delivered' }),
    );

    expect(missed).toEqual(['depositReceived', 'paymentConfirmed', 'readyForPickup']);
  });
});

describe('missedNoticeKinds', () => {
  it('no cuenta las etapas que el pedido todavia no alcanzo', () => {
    // Recien pago: que no haya recibido "listo para retirar" es lo esperado.
    expect(
      missedNoticeKinds('paid', ['orderReceived', 'depositReceived', 'paymentConfirmed']),
    ).toEqual([]);
  });

  it('marca lo que quedo sin mandar de las etapas ya superadas', () => {
    expect(missedNoticeKinds('ready', ['orderReceived'])).toEqual([
      'depositReceived',
      'paymentConfirmed',
      'readyForPickup',
    ]);
  });

  it('un pedido eliminado no debe ningun aviso', () => {
    expect(missedNoticeKinds('cancelled', [])).toEqual([]);
  });

  it('entregado exige todos los avisos: es el final del recorrido', () => {
    expect(missedNoticeKinds('delivered', [])).toEqual(EMAIL_KINDS);
    expect(missedNoticeKinds('delivered', [...EMAIL_KINDS])).toEqual([]);
  });
});

describe('vista previa de las plantillas', () => {
  const fakeOrders = (existente: Order | null) =>
    ({
      findByCode: async () => existente,
      list: async () => ({ orders: [], total: 0 }),
      summary: async () => ({ revenue: 0, discounts: 0, open: 0, counted: 0 }),
      create: async (o: Order) => o,
      updateStatus: async () => {
        throw new Error('no usado');
      },
    }) as unknown as Parameters<typeof createEmailsService>[2];

  const service = (existente: Order | null = null) => {
    const { transport } = fakeTransport();
    const { repository } = fakeLog();
    return createEmailsService(transport, repository, fakeOrders(existente));
  };

  it('sin codigo usa el pedido de ejemplo y no manda nada', async () => {
    const { transport, sent } = fakeTransport();
    const { repository } = fakeLog();
    const svc = createEmailsService(transport, repository, fakeOrders(null));

    const preview = await svc.preview('orderReceived', 'pending');

    expect(preview.isSample).toBe(true);
    expect(preview.subject).toContain('CAMG-2026-EJEMP');
    expect(preview.html).toContain('<!doctype html>');
    expect(preview.text.length).toBeGreaterThan(40);
    // Previsualizar no puede tener efectos: nadie recibe un mail por mirar.
    expect(sent).toHaveLength(0);
  });

  it('con un codigo real usa los datos de ese pedido', async () => {
    const real = order({ code: 'CAMG-2026-ABCDE', customerName: 'Alejandro' });

    const preview = await service(real).preview('readyForPickup', 'ready', real.code);

    expect(preview.isSample).toBe(false);
    expect(preview.recipient).toBe(real.email);
    expect(preview.html).toContain('Alejandro');
  });

  it('fuerza el estado del aviso: un pedido pendiente se ve como si ya estuviera listo', async () => {
    // Si no, previsualizar "listo para retirar" con un pedido pendiente
    // mostraria la plantilla con datos de otra etapa.
    const pendiente = order({ status: 'pending' });

    const preview = await service(pendiente).preview('readyForPickup', 'ready', pendiente.code);

    expect(preview.isSample).toBe(false);
    expect(preview.subject).toContain('listo para retirar');
  });

  it('un codigo que no existe es 404, no un ejemplo silencioso', async () => {
    await expect(service(null).preview('orderReceived', 'pending', 'CAMG-2026-ZZZZZ')).rejects.toMatchObject(
      { code: 'NOT_FOUND' },
    );
  });

  it('hay una vista previa para cada mail que existe', async () => {
    for (const kind of EMAIL_KINDS) {
      const preview = await service(null).preview(kind, 'pending');
      expect(preview.kind).toBe(kind);
      expect(preview.subject.length).toBeGreaterThan(10);
    }
  });
});
