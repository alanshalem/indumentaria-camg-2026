import { ROUTES, type LoginResponse, type SessionResponse } from '@shared/api/contracts';
import { httpClient } from './httpClient';

export const authService = {
  login: (password: string) => httpClient.post<LoginResponse>(ROUTES.auth.login, { password }),
  session: () => httpClient.get<SessionResponse>(ROUTES.auth.session),
};
