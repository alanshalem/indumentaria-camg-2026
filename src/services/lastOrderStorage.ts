const CODE_KEY = 'camg_last_order_code';
const DATE_KEY = 'camg_last_order_date';
const COOKIE = 'camg_order_code';
const ONE_YEAR_SECONDS = 31_536_000;

export interface LastOrderRef {
  code: string;
  date: number | null;
}

/**
 * Recordatorio del último pedido del socio. Vive en el browser a propósito:
 * es una comodidad de UX, no un dato de negocio (la verdad está en la API).
 */
export const lastOrderStorage = {
  read(): LastOrderRef | null {
    const code = localStorage.getItem(CODE_KEY);
    if (!code) return null;
    const date = Number(localStorage.getItem(DATE_KEY));
    return { code, date: Number.isFinite(date) && date > 0 ? date : null };
  },

  save(code: string): void {
    localStorage.setItem(CODE_KEY, code);
    localStorage.setItem(DATE_KEY, String(Date.now()));
    document.cookie = `${COOKIE}=${encodeURIComponent(code)}; max-age=${ONE_YEAR_SECONDS}; path=/; SameSite=Lax`;
  },

  clear(): void {
    localStorage.removeItem(CODE_KEY);
    localStorage.removeItem(DATE_KEY);
    document.cookie = `${COOKIE}=; max-age=0; path=/; SameSite=Lax`;
  },
};
