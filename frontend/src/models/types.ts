export interface User {
  id: string;
  name: string;
  role?: "student" | "employee" | "manager" | "admin" | "platform_admin";
  /** Vrai pour un compte du personnel créé avec un mot de passe temporaire. */
  mustChangePassword?: boolean;
  /** Restaurant du personnel (null pour un étudiant ou la plateforme) : sert à appliquer sa charte graphique. */
  restaurant?: { slug: string; name: string } | null;
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
// ...existing code...

export type RegisterPayload = Record<string, unknown>;
