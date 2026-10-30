export interface User {
  id: string;
  name: string;
}

/** Erreur renvoyée par le client HTTP : réponse d'erreur de l'API ou problème de réseau. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
