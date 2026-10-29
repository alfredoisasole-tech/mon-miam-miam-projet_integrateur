const API_BASE = "/api";

class HttpClient {
  private getToken(): string | null {
    try {
      return localStorage.getItem("mmm_token");
    } catch {
      return null;
    }
  }

  async get<T>(path: string): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, { headers });

    if (!res.ok) {
      const error: any = new Error(`HTTP ${res.status}`);
      error.status = res.status;
      if (res.status === 401) error.code = "UNAUTHORIZED";
      throw error;
    }

    return res.json();
  }

  async post<T>(path: string, body: any): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error: any = new Error(`HTTP ${res.status}`);
      error.status = res.status;
      throw error;
    }

    return res.json();
  }
}

export const api = new HttpClient();