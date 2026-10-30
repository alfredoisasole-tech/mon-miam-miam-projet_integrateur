import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import {
  AuthProvider,
  useAuth,
  RestaurantProvider,
  useRestaurant,
} from "../controllers/session";
import { api } from "../models/http";

// ─── Mock du client HTTP ─────────────────────────────────────────────────────

vi.mock("../models/http", () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockApi = api as unknown as { get: ReturnType<typeof vi.fn> };

// ─── Composants de test ──────────────────────────────────────────────────────

function AuthConsumer() {
  const { user, loading, login, logout } = useAuth();
  if (loading) return <div>loading</div>;
  return (
    <div>
      <div data-testid="user">{user ? user.name : "anonymous"}</div>
      <button onClick={() => login("fake-token")}>login</button>
      <button onClick={logout}>logout</button>
    </div>
  );
}

function RestaurantConsumer() {
  const { slug, setRestaurant, clearRestaurant } = useRestaurant();
  return (
    <div>
      <div data-testid="slug">{slug ?? "none"}</div>
      <button onClick={() => setRestaurant("zeduc-space")}>
        choose zeduc
      </button>
      <button onClick={clearRestaurant}>clear</button>
    </div>
  );
}

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// ─── Tests AuthProvider ──────────────────────────────────────────────────────

describe("AuthProvider", () => {
  it("affiche anonymous quand aucun jeton n'est stocké", async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );
    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("anonymous")
    );
  });

  it("charge le profil quand un jeton est présent", async () => {
    localStorage.setItem("mmm_token", "old-token");
    mockApi.get.mockResolvedValueOnce({ id: "u1", name: "Gloire" });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("Gloire")
    );
  });

  it("déconnecte si le profil renvoie 401", async () => {
    localStorage.setItem("mmm_token", "expired-token");
    mockApi.get.mockRejectedValueOnce({ code: "UNAUTHORIZED", status: 401 });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("anonymous")
    );
    expect(localStorage.getItem("mmm_token")).toBeNull();
  });

  it("mémorise le jeton après login", async () => {
    mockApi.get.mockResolvedValueOnce({ id: "u1", name: "Gloire" });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await userEvent.click(screen.getByText("login"));

    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("Gloire")
    );
    expect(localStorage.getItem("mmm_token")).toBe("fake-token");
  });

  it("efface le jeton après logout", async () => {
    localStorage.setItem("mmm_token", "token");
    mockApi.get.mockResolvedValueOnce({ id: "u1", name: "Gloire" });

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>
    );

    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("Gloire")
    );

    await userEvent.click(screen.getByText("logout"));

    await waitFor(() =>
      expect(screen.getByTestId("user").textContent).toBe("anonymous")
    );
    expect(localStorage.getItem("mmm_token")).toBeNull();
  });
});

// ─── Tests RestaurantProvider ────────────────────────────────────────────────

describe("RestaurantProvider", () => {
  it("mémorise le restaurant choisi", async () => {
    render(
      <RestaurantProvider>
        <RestaurantConsumer />
      </RestaurantProvider>
    );

    await userEvent.click(screen.getByText("choose zeduc"));

    expect(screen.getByTestId("slug").textContent).toBe("zeduc-space");
    expect(localStorage.getItem("mmm_restaurant")).toBe("zeduc-space");
  });

  it("retrouve le restaurant après rechargement", () => {
    localStorage.setItem("mmm_restaurant", "mini-delice");

    render(
      <RestaurantProvider>
        <RestaurantConsumer />
      </RestaurantProvider>
    );

    expect(screen.getByTestId("slug").textContent).toBe("mini-delice");
  });

  it("efface le restaurant quand on le demande", async () => {
    localStorage.setItem("mmm_restaurant", "zeduc-space");

    render(
      <RestaurantProvider>
        <RestaurantConsumer />
      </RestaurantProvider>
    );

    await userEvent.click(screen.getByText("clear"));

    expect(screen.getByTestId("slug").textContent).toBe("none");
    expect(localStorage.getItem("mmm_restaurant")).toBeNull();
  });
});