import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "../controllers/session";
import { api } from "../models/http";
import { authApi } from "../models/api";
import { LoginPage } from "../views/pages/LoginPage";

vi.mock("../models/api");
vi.mock("../models/http", () => ({
  api: {
    get: vi.fn(),
  },
}));

const mockedAuthApi = vi.mocked(authApi);
const mockedApi = vi.mocked(api);

describe("LoginPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  it("affiche le message du backend en cas d'échec", async () => {
    const message = "Identifiants incorrects";
    mockedAuthApi.login.mockRejectedValueOnce(new Error(message));

    render(
      <MemoryRouter initialEntries={["/login"]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/e-mail|téléphone/i), {
      target: { value: "fake@test.com" },
    });
    fireEvent.change(screen.getByLabelText(/mot de passe/i), {
      target: { value: "wrongpass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("redirige vers la page d'origine après une connexion réussie", async () => {
    mockedAuthApi.login.mockResolvedValueOnce({
      token: "abc",
      user: { id: "1", name: "Test", role: "student" },
    } as Awaited<ReturnType<typeof authApi.login>>);

    mockedApi.get.mockResolvedValueOnce({
      id: "1",
      name: "Test",
      role: "student",
    } as never);

    render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/login",
            state: { from: { pathname: "/panier" } },
          },
        ]}
      >
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/panier"
              element={<div data-testid="panier">Panier</div>}
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/e-mail|téléphone/i), {
      target: { value: "a@b.com" },
    });
    fireEvent.change(screen.getByLabelText(/mot de passe/i), {
      target: { value: "Pass1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /se connecter/i }));

    expect(await screen.findByTestId("panier")).toBeInTheDocument();
    expect(mockedApi.get).toHaveBeenCalledWith("/me");
  });
});