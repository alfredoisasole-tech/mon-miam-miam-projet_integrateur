import { useEffect, useState } from 'react';
import { api } from '../models/http';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPriceFc: number;
}

export interface Order {
  id: string;
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  totalFc: number;
  createdAt: string; // Format ISO 8601
  items: OrderItem[];
  restaurantName: string;
}

/**
 * Hook pour récupérer la liste des commandes de l'utilisateur connecté.
 * Endpoint supposé : GET /me/orders (ou /orders selon le backend de Don/Lusimafu)
 */
export function useMyOrders() {
  const [data, setData] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    // Pas de "/api" au début, http.ts l'ajoute via baseUrl
    api.get<Order[]>('/me/orders')
      .then((res) => {
        if (active) {
          // Trier par date décroissante (la plus récente en premier)
          const sorted = res.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setData(sorted);
        }
      })
      .catch(() => {
        if (active) {
          setError('Impossible de charger vos commandes.');
          setData([]);
            }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => { active = false; };
  }, []);

  return { data, isLoading, error };
}