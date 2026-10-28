import { ApiError } from './types';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type RequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
  idempotencyKey?: string;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, headers = {}, idempotencyKey } = options;

  const finalHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (token) {
    finalHeaders['Authorization'] = `Bearer ${token}`;
  }
  if (idempotencyKey) {
    finalHeaders['Idempotency-Key'] = idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Coupure réseau, DNS, CORS, etc.
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      'Connexion impossible au serveur. Vérifiez votre réseau.',
    );
  }

  // 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      response.status,
      'INVALID_JSON',
      'Réponse invalide du serveur.',
    );
  }

  if (!response.ok) {
    const payload = data as
      | { error?: { code?: string; message?: string } }
      | undefined;
    const code = payload?.error?.code ?? 'UNKNOWN_ERROR';
    const message = payload?.error?.message ?? 'Une erreur est survenue.';
    throw new ApiError(response.status, code, message);
  }

  return data as T;
}

export const http = {
  get: <T>(path: string, token?: string | null) =>
    request<T>(path, { method: 'GET', token }),

  post: <T>(
    path: string,
    body: unknown,
    token?: string | null,
    idempotencyKey?: string,
  ) => request<T>(path, { method: 'POST', body, token, idempotencyKey }),

  patch: <T>(path: string, body: unknown, token?: string | null) =>
    request<T>(path, { method: 'PATCH', body, token }),

  delete: <T>(path: string, token?: string | null) =>
    request<T>(path, { method: 'DELETE', token }),
};