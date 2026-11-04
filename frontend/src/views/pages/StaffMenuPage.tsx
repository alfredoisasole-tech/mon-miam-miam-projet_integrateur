import React, { useEffect, useState } from 'react';
import { adminMenuApi } from '../../controllers/adminMenu';
import { CATEGORY_LABEL } from '../../models/menuCategories';
import { RequireRole } from '../components/RequireRole';
import type { MenuDish } from '../../controllers/useMenu';
import { assetUrl } from '../../models/http';
import { formatPrice } from '../../models/format';
import { Badge, Empty, Spinner } from '../components/ui';

export const StaffMenuPage: React.FC = () => {
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
      <section className="staff-menu-page" data-testid="staff-menu-page">
        <header className="page-head">
          <div>
            <h1>Disponibilité du menu</h1>
            <p>Marquez un plat comme épuisé ou comme plat du jour : les clients le voient aussitôt.</p>
          </div>
        </header>

        {isLoading && <Spinner label="Chargement du menu…" />}
        {error && <div className="alert alert-error" role="alert" data-testid="error-message">{error}</div>}

        {!isLoading && dishes.length === 0 && !error && <Empty>Aucun plat dans le menu.</Empty>}

        {!isLoading && dishes.length > 0 && (
          <div className="table-wrap">
            <table className="data-table staff-dish-table" data-testid="dish-table">
              <thead>
                <tr>
                  <th scope="col">Plat</th>
                  <th scope="col">Catégorie</th>
                  <th scope="col" className="num">Prix</th>
                  <th scope="col">Disponible</th>
                  <th scope="col">Plat du jour</th>
                </tr>
              </thead>
              <tbody>
                {dishes.map((dish) => (
                  <tr key={dish.id} data-testid={`dish-row-${dish.id}`}>
                    <td>
                      <div className="row-actions">
                        {dish.imageUrl ? <img className="thumb" src={assetUrl(dish.imageUrl)} alt="" loading="lazy" /> : <span className="thumb-empty" aria-hidden="true">photo</span>}
                        <span>{dish.name}{!dish.isAvailable && <> <Badge kind="error">Épuisé</Badge></>}</span>
                      </div>
                    </td>
                    <td>{dish.category ? (CATEGORY_LABEL[dish.category] ?? dish.category) : '—'}</td>
                    <td className="num">{formatPrice(dish.priceFc)}</td>
                    <td>
                      <label className="check-field">
                        <input
                          type="checkbox"
                          checked={dish.isAvailable}
                          onChange={() => handleToggle(dish, 'isAvailable')}
                          disabled={actionLoading === dish.id}
                          aria-label={`${dish.name} : disponible`}
                          data-testid={`available-${dish.id}`}
                        />
                      </label>
                    </td>
                    <td>
                      <label className="check-field">
                        <input
                          type="checkbox"
                          checked={dish.isDaily}
                          onChange={() => handleToggle(dish, 'isDaily')}
                          disabled={actionLoading === dish.id}
                          aria-label={`${dish.name} : plat du jour`}
                          data-testid={`daily-${dish.id}`}
                        />
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </RequireRole>
  );
};
