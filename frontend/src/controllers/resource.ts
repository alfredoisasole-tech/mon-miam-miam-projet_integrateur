import { useEffect, useState, useCallback, useRef } from "react";

export type ResourceState<T> =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "success"; data: T; error?: undefined }
  | { status: "error"; data?: undefined; error: Error };

/**
 * Hook qui charge une ressource asynchrone, gère les états
 * loading/success/error, et peut se rafraîchir automatiquement
 * à un intervalle donné (pour les tableaux temps réel).
 */
export function useResource<T>(
  loader: () => Promise<T>,
  options: {
    /** Intervalle de rafraîchissement en ms. 0 = pas de refresh auto. */
    refreshIntervalMs?: number;
    /** Déclencheur : le chargement ne démarre que si cette valeur est truthy. */
    enabled?: boolean;
  } = {}
): ResourceState<T> & { refresh: () => void } {
  const { refreshIntervalMs = 0, enabled = true } = options;

  const [state, setState] = useState<ResourceState<T>>({ status: "loading" });
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const load = useCallback(() => {
    if (!enabled) return;
    setState({ status: "loading" });
    loaderRef
      .current()
      .then((data) => setState({ status: "success", data }))
      .catch((err) =>
        setState({
          status: "error",
          error: err instanceof Error ? err : new Error(String(err)),
        })
      );
  }, [enabled]);

  useEffect(() => {
    load();
  }, [load]);

  // Rafraîchissement automatique
  useEffect(() => {
    if (refreshIntervalMs <= 0 || !enabled) return;
    const id = window.setInterval(load, refreshIntervalMs);
    return () => window.clearInterval(id);
  }, [load, refreshIntervalMs, enabled]);

  return { ...state, refresh: load };
}