import React, { useEffect, useState } from 'react';
import { useAuth } from '../../controllers/session';
import { adminMenuApi } from '../../controllers/adminMenu';
import { RequireRole } from '../components/RequireRole';
import type { MenuDish } from '../../controllers/useMenu';

export const StaffMenuPage: React.FC = () => {
  const { user } = useAuth();
  const [dishes, setDishes] = useState<MenuDish[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadMenu = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminMenuApi.getStaffMenu();
      setDishes(data);
    } catch (err) {
      setError('Impossible de charger le menu.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMenu();
  }, []);

  const handleToggle = async (dish: MenuDish, field: 'isAvailable' | 'isDaily') => {
    setActionLoading(dish.id);
    setError(null);
    try {
      const updated = await adminMenuApi.staffUpdate(dish.id, {
        [field]: !dish[field],
      });
      setDishes((prev) => prev.map((d) => (d.id === dish.id ? updated : d)));
    } catch (err) {
      setError('Impossible de modifier le plat.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <RequireRole allowedRoles={['admin', 'manager', 'employee']}>
      <div className="staff-menu-page" data-testid="staff-menu-page">
        <h2>Gestion rapide du menu (Staff)</h2>
        <p>Connecté en tant que {user?.name} ({user?.role})</p>

        {isLoading && <p>Chargement du menu...</p>}
        {error && <p role="alert" data-testid="error-message">{error}</p>}

        {!isLoading && dishes.length === 0 && (
          <p>Aucun plat dans le menu.</p>
        )}

        {!isLoading && dishes.length > 0 && (
          <table className="staff-dish-table" data-testid="dish-table">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Catégorie</th>
                <th>Prix</th>
                <th>Disponible</th>
                <th>Plat du jour</th>
              </tr>
            </thead>
            <tbody>
              {dishes.map((dish) => (
                <tr key={dish.id} data-testid={`dish-row-${dish.id}`}>
                  <td>{dish.name}</td>
                  <td>-</td>
                  <td>{dish.priceFc} FC</td>
                  <td>
                    <label>
                      <input
                        type="checkbox"
                        checked={dish.isAvailable}
                        onChange={() => handleToggle(dish, 'isAvailable')}
                        disabled={actionLoading === dish.id}
                        data-testid={`available-${dish.id}`}
                      />
                    </label>
                  </td>
                  <td>
                    <label>
                      <input
                        type="checkbox"
                        checked={dish.isDaily}
                        onChange={() => handleToggle(dish, 'isDaily')}
                        disabled={actionLoading === dish.id}
                        data-testid={`daily-${dish.id}`}
                      />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </RequireRole>
  );
};