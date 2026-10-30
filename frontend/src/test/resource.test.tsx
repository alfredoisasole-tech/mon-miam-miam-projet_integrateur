import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useResource } from "../controllers/resource";

afterEach(() => {
  vi.useRealTimers();
});

describe("useResource", () => {
  it("charge la ressource et passe à success", async () => {
    const loader = vi.fn().mockResolvedValue(["plat"]);

    const { result } = renderHook(() => useResource(loader));

    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });

    expect(result.current).toMatchObject({
      status: "success",
      data: ["plat"],
    });
    expect(loader).toHaveBeenCalledOnce();
  });

  it("expose une erreur si le chargement échoue", async () => {
    const loader = vi.fn().mockRejectedValue("Erreur réseau");

    const { result } = renderHook(() => useResource(loader));

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });

    expect(result.current).toMatchObject({
      status: "error",
      error: new Error("Erreur réseau"),
    });
  });

  it("relance le chargement avec refresh", async () => {
    const loader = vi
      .fn()
      .mockResolvedValueOnce("première valeur")
      .mockResolvedValueOnce("valeur actualisée");

    const { result } = renderHook(() => useResource(loader));

    await waitFor(() => {
      expect(result.current.status).toBe("success");
    });

    act(() => result.current.refresh());

    await waitFor(() => {
      expect(result.current).toMatchObject({
        status: "success",
        data: "valeur actualisée",
      });
    });

    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("ne charge pas quand disabled, puis charge quand enabled", async () => {
    const loader = vi.fn().mockResolvedValue("chargé");

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useResource(loader, { enabled }),
      { initialProps: { enabled: false } }
    );

    expect(loader).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current).toMatchObject({
        status: "success",
        data: "chargé",
      });
    });

    expect(loader).toHaveBeenCalledOnce();
  });

  it("rafraîchit automatiquement à l’intervalle configuré", async () => {
    const loader = vi.fn().mockResolvedValue("donnée");

    const { rerender } = renderHook(
      ({ refreshIntervalMs }: { refreshIntervalMs: number }) =>
        useResource(loader, { refreshIntervalMs }),
      { initialProps: { refreshIntervalMs: 0 } }
    );

    await waitFor(() => {
      expect(loader).toHaveBeenCalledOnce();
    });

    vi.useFakeTimers();
    rerender({ refreshIntervalMs: 100 });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(loader).toHaveBeenCalledTimes(2);
  });
});