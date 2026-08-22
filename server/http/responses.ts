import type { ApiResponse } from './types';

export const ok = <T>(data: T): ApiResponse => ({ status: 200, body: { data } });
export const created = <T>(data: T): ApiResponse => ({ status: 201, body: { data } });
export const noContent = (): ApiResponse => ({ status: 204 });

export const withCache = (response: ApiResponse, seconds: number): ApiResponse => ({
  ...response,
  headers: {
    ...response.headers,
    'Cache-Control': `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds * 4}`,
  },
});
