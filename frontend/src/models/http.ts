import { ApiError } from "./types.ts";

const baseUrl = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/+$/, "");

type Methode = "GET" | "POST" | "PATCH" | "DELETE";

interface Options {
  methode?: Methode;
  corps?: unknown;
  idempotencyKey?: string;
}

interface CorpsErreur {
  error?: { code?: string; message?: string; details?: unknown };
}

function lireJeton(): string | null {
  try {
    return localStorage.getItem("mmm_token");
  } catch {
    // localStorage peut être indisponible (navigation privée, quota…).
    return null;
  }
}

async function requete<T>(chemin: string, options: Options = {}): Promise<T> {
  const { methode = "GET", corps, idempotencyKey } = options;

  const entetes: Record<string, string> = {};
  const jeton = lireJeton();
  if (jeton) entetes.Authorization = `Bearer ${jeton}`;
  if (corps !== undefined) entetes["Content-Type"] = "application/json";
  if (idempotencyKey) entetes["Idempotency-Key"] = idempotencyKey;

  let reponse: Response;
  try {
    reponse = await fetch(`${baseUrl}/${chemin.replace(/^\/+/, "")}`, {
      method: methode,
      headers: entetes,
      body: corps !== undefined ? JSON.stringify(corps) : undefined,
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Connexion impossible au serveur. Vérifiez votre réseau.",
    );
  }

  if (reponse.status === 204) return undefined as T;

  let donnees: unknown;
  try {
    donnees = await reponse.json();
  } catch {
    throw new ApiError(reponse.status, "INVALID_JSON", "Réponse invalide du serveur.");
  }

  if (!reponse.ok) {
    // Format d'erreur commun de l'API : { error: { code, message, details } }
    const erreur = (donnees as CorpsErreur | null)?.error;
    throw new ApiError(
      reponse.status,
      erreur?.code ?? (reponse.status === 401 ? "UNAUTHORIZED" : "HTTP_ERROR"),
      erreur?.message ?? "Une erreur est survenue.",
      erreur?.details,
    );
  }

  return donnees as T;
}

export const api = {
  get: <T>(chemin: string) => requete<T>(chemin),

  post: <T>(chemin: string, corps?: unknown, options?: { idempotencyKey?: string }) =>
    requete<T>(chemin, { methode: "POST", corps, idempotencyKey: options?.idempotencyKey }),

  patch: <T>(chemin: string, corps?: unknown) =>
    requete<T>(chemin, { methode: "PATCH", corps }),

  delete: <T>(chemin: string) => requete<T>(chemin, { methode: "DELETE" }),
};
