import type { ApiResponse } from './types.js';

export const ok = <T>(data: T): ApiResponse => ({ status: 200, body: { data } });
export const created = <T>(data: T): ApiResponse => ({ status: 201, body: { data } });
export const noContent = (): ApiResponse => ({ status: 204 });
