import React, { useEffect, useState } from 'react';
import { useAuth } from '../../controllers/session';
import { adminMenuApi, type CreateDishPayload } from '../../controllers/adminMenu';
import { RequireRole } from '../components/RequireRole';
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
      <div className="admin-menu-page" data-testid="admin-menu-page">
        <h2>Administration du Menu</h2>
        <p>Connecté en tant que {user?.name} ({user?.role})</p>

        <div className="header-actions">
          <button onClick={() => setShowForm(!showForm)} data-testid="toggle-form-btn">
            {showForm ? 'Annuler' : '+ Ajouter un plat'}
          </button>
        </div>

        {error && <p role="alert" data-testid="error-message">{error}</p>}

        {showForm && (
          <form onSubmit={handleSubmit} className="add-dish-form" data-testid="add-dish-form">
            <div>
              <label htmlFor="dish-name">Nom</label>
              <input
                id="dish-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                data-testid="input-name"
              />
              {formErrors.name && <p className="field-error" data-testid="error-name">{formErrors.name}</p>}
            </div>

            <div>
              <label htmlFor="dish-description">Description</label>
              <input
                id="dish-description"
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="dish-price">Prix (FC)</label>
              <input
                id="dish-price"
                type="number"
                min="0"
                value={formData.priceFc || ''}
                onChange={(e) => setFormData({ ...formData, priceFc: parseInt(e.target.value) || 0 })}
                data-testid="input-price"
              />
              {formErrors.priceFc && <p className="field-error" data-testid="error-price">{formErrors.priceFc}</p>}
            </div>

            <div>
              <label htmlFor="dish-category">Catégorie</label>
              <select
                id="dish-category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as CreateDishPayload['category'] })}
                data-testid="input-category"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {formErrors.category && <p className="field-error">{formErrors.category}</p>}
            </div>

            <div>
              <label>
                <input
                  type="checkbox"
                  checked={formData.isDaily}
                  onChange={(e) => setFormData({ ...formData, isDaily: e.target.checked })}
                  data-testid="input-daily"
                />
                Plat du jour
              </label>
            </div>

            <div>
              <label>
                <input
                  type="checkbox"
                  checked={formData.isAvailable}
                  onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                />
                Disponible
              </label>
            </div>

            <button type="submit" disabled={formLoading} data-testid="submit-btn">
              {formLoading ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        )}

        {isLoading && <p>Chargement du menu...</p>}

        {!isLoading && dishes.length === 0 && <p>Aucun plat dans le menu.</p>}

        {!isLoading && dishes.length > 0 && (
          <ul className="admin-dish-list" data-testid="dish-list">
            {dishes.map((dish) => (
              <li key={dish.id} data-testid={`dish-item-${dish.id}`}>
                <span>{dish.name} - {dish.priceFc} FC</span>
                <button
                  onClick={() => handleDelete(dish.id)}
                  data-testid={`delete-${dish.id}`}
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </RequireRole>
  );
};