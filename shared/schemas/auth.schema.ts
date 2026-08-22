import { z } from 'zod';

export const loginSchema = z.object({
  password: z.string().min(1, 'Ingresá la clave').max(200),
});

export type LoginDto = z.infer<typeof loginSchema>;
