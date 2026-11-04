import React, { useEffect, useState } from 'react';
import { useAuth } from '../../controllers/session';
import { adminMenuApi } from '../../controllers/adminMenu';
import { RequireRole } from '../components/RequireRole';
import { Card } from '../components/ui';
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
      <div className="staff-menu-page" data-testid="staff-menu-page" style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <header style={{ borderBottom: '1px solid var(--mm-line)', paddingBottom: '1rem', marginBottom: '2rem' }}>
          <div className="eyebrow" style={{ color: 'var(--mm-accent)', marginBottom: '0.25rem' }}>Espace Cuisine</div>
          <h2 style={{ fontSize: '1.85rem', margin: '0 0 0.25rem' }}>Gestion rapide du menu (Staff)</h2>
          <p className="muted" style={{ margin: 0, fontSize: '0.95rem' }}>
            Connecté en tant que {user?.name} ({user?.role})
          </p>
        </header>

        {isLoading && <p className="muted">Chargement du menu...</p>}
        {error && <p className="alert alert-error" role="alert" data-testid="error-message">{error}</p>}

        {!isLoading && dishes.length === 0 && (
          <div className="empty">
            <p style={{ color: 'var(--mm-muted)', margin: 0 }}>Aucun plat dans le menu.</p>
          </div>
        )}

        {!isLoading && dishes.length > 0 && (
          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table className="staff-dish-table" data-testid="dish-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1.5px solid var(--mm-line)', color: 'var(--mm-muted)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Nom</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Catégorie</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>Prix</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'center' }}>Disponible</th>
                    <th style={{ padding: '0.85rem 1rem', fontWeight: 600, textAlign: 'center' }}>Plat du jour</th>
                  </tr>
                </thead>
                <tbody>
                  {dishes.map((dish) => (
                    <tr key={dish.id} data-testid={`dish-row-${dish.id}`} style={{ borderBottom: '1px solid var(--mm-surface-subtle)' }}>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--mm-text)' }}>{dish.name}</td>
                      <td style={{ padding: '0.85rem 1rem', color: 'var(--mm-muted)' }}>-</td>
                      <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>{dish.priceFc} FC</td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                          <input
                            type="checkbox"
                            checked={dish.isAvailable}
                            onChange={() => handleToggle(dish, 'isAvailable')}
                            disabled={actionLoading === dish.id}
                            data-testid={`available-${dish.id}`}
                          />
                        </label>
                      </td>
                      <td style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
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
            </div>
          </Card>
        )}
      </div>
    </RequireRole>
  );
};