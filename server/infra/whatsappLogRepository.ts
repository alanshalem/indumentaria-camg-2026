import type { WhatsappLogRecord, WhatsappTemplate } from '../../shared/domain/whatsapp.js';

export type { WhatsappLogRecord };
import { toHttpError } from './postgrestError.js';
import { getSupabase } from './supabaseClient.js';

const TABLE = 'whatsapp_log';

export interface WhatsappLogRepository {
  history(orderCode: string): Promise<WhatsappLogRecord[]>;
  record(orderCode: string, template: WhatsappTemplate): Promise<void>;
}

export const whatsappLogRepository: WhatsappLogRepository = {
  async history(orderCode) {
    const { data, error } = await getSupabase()
      .from(TABLE)
      .select('template, prepared_at')
      .eq('order_code', orderCode)
      .order('prepared_at', { ascending: false });

    if (error) throw toHttpError(error, 'whatsappLog.history');

    return (data ?? []).map((row) => ({
      template: row.template as WhatsappTemplate,
      preparedAt: new Date(row.prepared_at as string).getTime(),
    }));
  },

  async record(orderCode, template) {
    // Se guarda cada vez: que el club haya reenviado el link de pago tres veces
    // es justamente lo que quiere ver cuando el socio no paga.
    const { error } = await getSupabase()
      .from(TABLE)
      .insert({ order_code: orderCode, template });

    if (error) throw toHttpError(error, 'whatsappLog.record');
  },
};
