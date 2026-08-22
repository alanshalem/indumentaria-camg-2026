import { tooManyRequests } from '../http/errors.js';

interface Bucket {
  hits: number[];
}

/**
 * Ventana deslizante en memoria. En serverless el estado vive por instancia,
 * así que no es una defensa perfecta — pero frena el fuerza-bruta trivial sin
 * sumar Redis a un proyecto de este tamaño (KISS). El costo de equivocarse es
 * bajo: como mucho, un atacante distribuido consigue algunos intentos extra.
 */
export class SlidingWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  /** Registra un intento; lanza 429 si el identificador superó el límite. */
  consume(key: string, now = Date.now()): void {
    const bucket = this.buckets.get(key) ?? { hits: [] };
    bucket.hits = bucket.hits.filter((at) => now - at < this.windowMs);

    if (bucket.hits.length >= this.limit) {
      const retryInSec = Math.ceil((this.windowMs - (now - bucket.hits[0]!)) / 1000);
      this.buckets.set(key, bucket);
      throw tooManyRequests(`Demasiados intentos. Probá de nuevo en ${retryInSec} segundos.`);
    }

    bucket.hits.push(now);
    this.buckets.set(key, bucket);
    this.evictStale(now);
  }

  reset(key: string): void {
    this.buckets.delete(key);
  }

  private evictStale(now: number): void {
    if (this.buckets.size < 500) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.hits.every((at) => now - at >= this.windowMs)) this.buckets.delete(key);
    }
  }
}

export const loginRateLimiter = new SlidingWindowRateLimiter(8, 5 * 60 * 1000);
