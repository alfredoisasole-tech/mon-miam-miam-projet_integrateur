import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../models/http.ts";
import { ApiError } from "../models/types.ts";

const fetchMock = vi.fn();

function reponse(status: number, corps?: unknown): Response {
  const fausse = {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corps,
  };
  return fausse as unknown as Response;
}

function reponseSansJson(status: number): Response {
  const fausse = {
    ok: status >= 200 && status < 300,
    status,
    json: async () => {
      throw new SyntaxError("Réponse non JSON");
    },
  };
  return fausse as unknown as Response;
}

function appel(index = 0) {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, init, headers: (init.headers ?? {}) as Record<string, string> };
}

beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Client HTTP : requêtes", () => {
  it("envoie le jeton enregistré dans l'en-tête Authorization", async () => {
    localStorage.setItem("mmm_token", "MON_JETON");
    fetchMock.mockResolvedValue(reponse(200, { ok: true }));

    await api.get("/me");

    const { url, init, headers } = appel();
    expect(url).toBe("/api/me");
    expect(init.method).toBe("GET");
    expect(headers.Authorization).toBe("Bearer MON_JETON");
  });

  it("n'envoie pas d'en-tête Authorization sans jeton", async () => {
    fetchMock.mockResolvedValue(reponse(200, {}));

    await api.get("/restaurants");

    expect(appel().headers.Authorization).toBeUndefined();
  });

  it("fonctionne même si le stockage du navigateur est bloqué", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Stockage bloqué");
    });
    fetchMock.mockResolvedValue(reponse(200, {}));

    await expect(api.get("/restaurants")).resolves.toEqual({});
    expect(appel().headers.Authorization).toBeUndefined();
  });

  it("envoie un corps JSON avec POST", async () => {
    fetchMock.mockResolvedValue(reponse(201, { id: "u1" }));

    await api.post("/auth/register", { email: "etudiant@example.com" });

    const { url, init, headers } = appel();
    expect(url).toBe("/api/auth/register");
    expect(init.method).toBe("POST");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ email: "etudiant@example.com" }));
  });

  it("ajoute la clé d'idempotence quand elle est donnée", async () => {
    fetchMock.mockResolvedValue(reponse(201, {}));

    await api.post("/orders", { items: [] }, { idempotencyKey: "cle-1" });

    expect(appel().headers["Idempotency-Key"]).toBe("cle-1");
  });

  it("n'ajoute pas de clé d'idempotence par défaut", async () => {
    fetchMock.mockResolvedValue(reponse(201, {}));

    await api.post("/orders", { items: [] });

    expect(appel().headers["Idempotency-Key"]).toBeUndefined();
  });

  it("gère PATCH et DELETE", async () => {
    fetchMock.mockResolvedValue(reponse(200, {}));

    await api.patch("/orders/o1", { status: "confirmed" });
    await api.delete("/orders/o1");

    expect(appel(0).init.method).toBe("PATCH");
    expect(appel(1).init.method).toBe("DELETE");
  });

  it("renvoie undefined pour une réponse 204", async () => {
    fetchMock.mockResolvedValue(reponse(204));

    await expect(api.delete("/orders/o1")).resolves.toBeUndefined();
  });
});

describe("Client HTTP : erreurs", () => {
  it("lit le code, le message et les détails renvoyés par l'API", async () => {
    fetchMock.mockResolvedValue(
      reponse(422, {
        error: {
          code: "VALIDATION_ERROR",
          message: "Données invalides",
          details: { field: "email" },
        },
      }),
    );

    const echec = api.post("/auth/register", {});

    await expect(echec).rejects.toBeInstanceOf(ApiError);
    await expect(echec).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
      message: "Données invalides",
      details: { field: "email" },
    });
  });

  it("donne un message en français quand le réseau est coupé", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(api.get("/me")).rejects.toMatchObject({
      status: 0,
      code: "NETWORK_ERROR",
      message: "Connexion impossible au serveur. Vérifiez votre réseau.",
    });
  });

  it("signale une réponse qui n'est pas du JSON", async () => {
    fetchMock.mockResolvedValue(reponseSansJson(502));

    await expect(api.get("/me")).rejects.toMatchObject({
      status: 502,
      code: "INVALID_JSON",
    });
  });

  it("utilise UNAUTHORIZED pour un 401 sans code", async () => {
    fetchMock.mockResolvedValue(reponse(401, {}));

    await expect(api.get("/me")).rejects.toMatchObject({
      status: 401,
      code: "UNAUTHORIZED",
    });
  });

  it("donne un message par défaut quand l'API n'en fournit pas", async () => {
    fetchMock.mockResolvedValue(reponse(500, {}));

    await expect(api.get("/me")).rejects.toMatchObject({
      status: 500,
      code: "HTTP_ERROR",
      message: "Une erreur est survenue.",
    });
  });
});
