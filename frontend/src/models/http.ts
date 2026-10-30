interface ApiError extends Error {
  code: string;
  status: number;
}

const baseUrl = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/+$/, "");

export const api = {
  async get<T>(path: string): Promise<T> {
    let token: string | null = null;

    try {
      token = localStorage.getItem("mmm_token");
    } catch {
      // localStorage peut être indisponible.
    }

    const response = await fetch(`${baseUrl}/${path.replace(/^\/+/, "")}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) {
      const error = new Error(`Erreur HTTP ${response.status}`) as ApiError;
      error.status = response.status;
      error.code = response.status === 401 ? "UNAUTHORIZED" : "HTTP_ERROR";
      throw error;
    }

    return (await response.json()) as T;
  },
};