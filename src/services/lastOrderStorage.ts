const CODE_KEY = 'camg_last_order_code';
const DATE_KEY = 'camg_last_order_date';
const TOKEN_KEY = 'camg_last_order_token';
const COOKIE = 'camg_order_code';
const ONE_YEAR_SECONDS = 31_536_000;

export interface LastOrderRef {
  code: string;
  date: number | null;
  /**
   * Firma del link de seguimiento, tal como la devolvió el checkout.
   * Sin ella el código es un número que no lleva a ningún lado.
   */
  token: string | null;
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
    return {
      code,
      date: Number.isFinite(date) && date > 0 ? date : null,
      // Los pedidos guardados antes de que existiera el link no tienen token:
      // se muestra el código igual, sin link.
      token: localStorage.getItem(TOKEN_KEY),
    };
  },

  save(code: string, token: string): void {
    localStorage.setItem(CODE_KEY, code);
    localStorage.setItem(DATE_KEY, String(Date.now()));
    localStorage.setItem(TOKEN_KEY, token);
    document.cookie = `${COOKIE}=${encodeURIComponent(code)}; max-age=${ONE_YEAR_SECONDS}; path=/; SameSite=Lax`;
  },

  clear(): void {
    localStorage.removeItem(CODE_KEY);
    localStorage.removeItem(DATE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    document.cookie = `${COOKIE}=; max-age=0; path=/; SameSite=Lax`;
  },
};
