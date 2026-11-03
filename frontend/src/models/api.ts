// src/models/api.ts
import { api as http } from "./http";
import type { RegisterPayload, User } from "./types";

export const authApi = {
  register: (data: RegisterPayload) =>
    http.post<{ token: string; user: User }>('/api/auth/register', data),

  // 👇 AJOUT POUR G-5
  login: (data: { identifier: string; password: string }) =>
    http.post<{ token: string; user: User }>('/auth/login', data),

  me: () => http.get<User>('/api/me'),
};
