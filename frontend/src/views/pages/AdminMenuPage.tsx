import React, { useEffect, useState } from 'react';
import { useAuth } from '../../controllers/session';
import { adminMenuApi, type CreateDishPayload } from '../../controllers/adminMenu';
import { RequireRole } from '../components/RequireRole';
import { Card } from '../components/ui';
import type { MenuDish } from '../../controllers/useMenu';

const CATEGORIES: Array<CreateDishPayload['category']> = ['plat', 'boisson', 'dessert', 'snack'];

export const AdminMenuPage: React.FC = () => {
  const { user } = useAuth();
  const [dishes, setDishes] = useState<MenuDish[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<CreateDishPayload>({
    name: '',
    description: '',
    priceFc: 0,
    category: 'plat',
    isDaily: false,
    isAvailable: true,
  });

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

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (formData.name.trim().length < 2 || formData.name.trim().length > 80) {
      errors.name = 'Le nom doit contenir entre 2 et 80 caractères.';
    }
    if (formData.priceFc < 0) {
      errors.priceFc = 'Le prix doit être un entier positif.';
    }
    if (!CATEGORIES.includes(formData.category)) {
      errors.category = 'Catégorie invalide.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setFormLoading(true);
    setError(null);
    try {
      await adminMenuApi.createDish(formData);
      setShowForm(false);
      setFormData({
        name: '',
        description: '',
        priceFc: 0,
        category: 'plat',
        isDaily: false,
        isAvailable: true,
      });
      await loadMenu();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la création du plat.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (dishId: string) => {
    if (!confirm('Supprimer ce plat ?')) return;
    setError(null);
    try {
      await adminMenuApi.deleteDish(dishId);
      await loadMenu();
    } catch (err: any) {
      setError(err?.message || 'Erreur lors de la suppression.');
    }
  };

  return (
    <RequireRole allowedRoles={['admin']}>
      <div className="admin-menu-page" data-testid="admin-menu-page" style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--mm-line)', paddingBottom: '1.25rem', marginBottom: '2rem' }}>
          <div>
            <div className="eyebrow" style={{ color: 'var(--mm-accent)', marginBottom: '0.25rem' }}>Espace Direction Restaurant</div>
            <h2 style={{ fontSize: '1.85rem', margin: '0 0 0.25rem' }}>Administration du Menu</h2>
            <p className="muted" style={{ margin: 0, fontSize: '0.95rem' }}>
              Connecté en tant que {user?.name} ({user?.role})
            </p>
          </div>

          <div className="header-actions">
            <button
              onClick={() => setShowForm(!showForm)}
              className={showForm ? 'btn btn-outline' : 'btn btn-primary'}
              data-testid="toggle-form-btn"
            >
              {showForm ? 'Annuler' : '+ Ajouter un plat'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ marginBottom: '1.5rem' }}>
            <p className="alert alert-error" role="alert" data-testid="error-message">{error}</p>
          </div>
        )}

        {showForm && (
          <div style={{ marginBottom: '2.5rem' }}>
            <Card title="Créer un nouveau plat">
              <form onSubmit={handleSubmit} className="add-dish-form" data-testid="add-dish-form" style={{ display: 'grid', gap: '1.25rem', marginTop: '1rem' }}>
                <div className="field">
                  <label htmlFor="dish-name" className="field-label">Nom du plat</label>
                  <input
                    id="dish-name"
                    type="text"
                    placeholder="Ex: Poulet braisé aux bananes"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    data-testid="input-name"
                  />
                  {formErrors.name && <p className="field-error" data-testid="error-name">{formErrors.name}</p>}
                </div>

                <div className="field">
                  <label htmlFor="dish-description" className="field-label">Description (ingrédients ou accompagnements)</label>
                  <input
                    id="dish-description"
                    type="text"
                    placeholder="Ex: Servi avec alloco et sauce piment"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="two">
                  <div className="field">
                    <label htmlFor="dish-price" className="field-label">Prix (FC)</label>
                    <input
                      id="dish-price"
                      type="number"
                      min="0"
                      placeholder="Ex: 3500"
                      value={formData.priceFc || ''}
                      onChange={(e) => setFormData({ ...formData, priceFc: parseInt(e.target.value) || 0 })}
                      data-testid="input-price"
                    />
                    {formErrors.priceFc && <p className="field-error" data-testid="error-price">{formErrors.priceFc}</p>}
                  </div>

                  <div className="field">
                    <label htmlFor="dish-category" className="field-label">Catégorie</label>
                    <select
                      id="dish-category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as CreateDishPayload['category'] })}
                      data-testid="input-category"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                      ))}
                    </select>
                    {formErrors.category && <p className="field-error">{formErrors.category}</p>}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '2rem', padding: '0.75rem 0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={formData.isDaily}
                      onChange={(e) => setFormData({ ...formData, isDaily: e.target.checked })}
                      data-testid="input-daily"
                    />
                    Plat du jour
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={formData.isAvailable}
                      onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                    />
                    Disponible
                  </label>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '0.5rem' }}>
                  <button type="submit" disabled={formLoading} className="btn btn-primary" data-testid="submit-btn" style={{ minWidth: '160px' }}>
                    {formLoading ? 'Enregistrement...' : 'Enregistrer le plat'}
                  </button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {isLoading && <p className="muted">Chargement du menu...</p>}

        {!isLoading && dishes.length === 0 && (
          <div className="empty">
            <p style={{ color: 'var(--mm-muted)', margin: 0 }}>Aucun plat dans le menu.</p>
          </div>
        )}

        {!isLoading && dishes.length > 0 && (
          <Card title="Carte des plats existants">
            <ul className="admin-dish-list" data-testid="dish-list" style={{ listStyle: 'none', padding: 0, margin: '1rem 0 0' }}>
              {dishes.map((dish) => (
                <li
                  key={dish.id}
                  data-testid={`dish-item-${dish.id}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 0',
                    borderBottom: '1px solid var(--mm-line)',
                    gap: '1rem',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--mm-text)' }}>
                      {dish.name}
                    </div>
                    <div style={{ color: 'var(--mm-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                      {dish.priceFc} FC {dish.isDaily && '· ⭐ Plat du jour'} {!dish.isAvailable && '· (Épuisé)'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(dish.id)}
                    data-testid={`delete-${dish.id}`}
                    style={{
                      background: 'none',
                      border: '1px solid var(--mm-danger-border)',
                      color: 'var(--mm-danger)',
                      borderRadius: 'var(--mm-radius-sm)',
                      padding: '0.4rem 0.85rem',
                      cursor: 'pointer',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </RequireRole>
  );
};