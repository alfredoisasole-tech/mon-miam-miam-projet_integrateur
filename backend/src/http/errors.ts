/** Erreur prévue par les règles de l'application : elle porte son statut HTTP, un code stable et un message en français. */
export class AppError extends Error {
  status: number;
  code: string;
  details: unknown[];

  constructor(status: number, code: string, message: string, details: unknown[] = []) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
