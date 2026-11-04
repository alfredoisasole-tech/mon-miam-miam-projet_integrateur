import React, { useEffect, useState } from 'react';
import { adminMenuApi, type CreateDishPayload } from '../../controllers/adminMenu';
import { CATEGORIES, CATEGORY_LABEL } from '../../models/menuCategories';
import { RequireRole } from '../components/RequireRole';
import type { MenuDish } from '../../controllers/useMenu';
import { MAX_LOGO_BYTES, settingsApi } from '../../controllers/settings';
import { assetUrl } from '../../models/http';
import { formatPrice } from '../../models/format';
import { Badge, Card, Empty, Spinner } from '../components/ui';

const emptyForm = (): CreateDishPayload => ({
  name: '',
  description: '',
  priceFc: 0,
  category: 'plat',
  isDaily: false,
  isAvailable: true,
});

export const AdminMenuPage: React.FC = () => {
  const [dishes, setDishes] = useState<MenuDish[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<CreateDishPayload>(emptyForm());

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

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormErrors({});
    setFormData(emptyForm());
  };

  const startEdit = (dish: MenuDish) => {
    setNotice(null);
    setError(null);
    setEditingId(dish.id);
    setFormData({
      name: dish.name,
      description: dish.description ?? '',
      priceFc: dish.priceFc,
      category: (CATEGORIES.includes(dish.category as CreateDishPayload['category']) ? dish.category : 'plat') as CreateDishPayload['category'],
      isDaily: dish.isDaily,
      isAvailable: dish.isAvailable,
    });
    setShowForm(true);
  };

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

  const handlePhoto = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) { setError('La photo dépasse 512 Ko.'); return; }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('La photo doit être une image PNG, JPEG ou WebP.'); return; }
    setError(null);
    try {
      const asset = await settingsApi.uploadAsset('menu', file);
      setFormData((previous) => ({ ...previous, imageAssetId: asset.id }));
    } catch (err: any) {
      setError(err?.message || 'Envoi de la photo impossible.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setFormLoading(true);
    setError(null);
    try {
      if (editingId) {
        await adminMenuApi.updateDish(editingId, formData);
        setNotice(`« ${formData.name.trim()} » est mis à jour.`);
      } else {
        await adminMenuApi.createDish(formData);
        setNotice(`« ${formData.name.trim()} » est ajouté au menu.`);
      }
      closeForm();
      await loadMenu();
    } catch (err: any) {
      setError(err?.message || (editingId ? 'Erreur lors de la modification du plat.' : 'Erreur lors de la création du plat.'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (dish: MenuDish) => {
    setError(null);
    setNotice(null);
    try {
      await adminMenuApi.deleteDish(dish.id);
      setConfirmingId(null);
      setNotice(`« ${dish.name} » est retiré du menu.`);
      await loadMenu();
    } catch (err: any) {
      setConfirmingId(null);
      setError(err?.message || 'Erreur lors de la suppression.');
    }
  };

  return (
    <RequireRole allowedRoles={['admin']}>
      <section className="admin-menu-page" data-testid="admin-menu-page">
        <header className="page-head">
          <div>
            <h1>Menu du restaurant</h1>
            <p>Ajoutez, modifiez ou retirez des plats. Les clients voient les changements aussitôt.</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => (showForm ? closeForm() : (setNotice(null), setShowForm(true)))}
            data-testid="toggle-form-btn"
          >
            {showForm ? 'Annuler' : '+ Ajouter un plat'}
          </button>
        </header>

        {error && <div className="alert alert-error" role="alert" data-testid="error-message">{error}</div>}
        {notice && <div className="alert alert-success" role="status">{notice}</div>}

        {showForm && (
          <Card title={editingId ? 'Modifier le plat' : 'Nouveau plat'}>
            <form onSubmit={handleSubmit} className="add-dish-form" data-testid="add-dish-form" noValidate>
              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor="dish-name">Nom</label>
                  <input
                    id="dish-name"
                    type="text"
                    value={formData.name}
                    aria-invalid={formErrors.name ? true : undefined}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    data-testid="input-name"
                  />
                  {formErrors.name && <small className="field-error" data-testid="error-name">{formErrors.name}</small>}
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="dish-price">Prix (FC)</label>
                  <input
                    id="dish-price"
                    type="number"
                    min="0"
                    value={formData.priceFc || ''}
                    aria-invalid={formErrors.priceFc ? true : undefined}
                    onChange={(e) => setFormData({ ...formData, priceFc: parseInt(e.target.value) || 0 })}
                    data-testid="input-price"
                  />
                  {formErrors.priceFc && <small className="field-error" data-testid="error-price">{formErrors.priceFc}</small>}
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="dish-category">Catégorie</label>
                  <select
                    id="dish-category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as CreateDishPayload['category'] })}
                    data-testid="input-category"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{CATEGORY_LABEL[cat]}</option>
                    ))}
                  </select>
                  {formErrors.category && <small className="field-error">{formErrors.category}</small>}
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="dish-photo">Photo</label>
                  <input
                    id="dish-photo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => void handlePhoto(e.target.files?.[0])}
                  />
                  <small className="muted">PNG, JPEG ou WebP, 512 Ko au plus{editingId ? ' ; laissez vide pour garder la photo actuelle' : ''}</small>
                </div>
              </div>

              <div className="field">
                <label className="field-label" htmlFor="dish-description">Description</label>
                <input
                  id="dish-description"
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="row">
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={formData.isDaily}
                    onChange={(e) => setFormData({ ...formData, isDaily: e.target.checked })}
                    data-testid="input-daily"
                  />
                  Plat du jour
                </label>
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={formData.isAvailable}
                    onChange={(e) => setFormData({ ...formData, isAvailable: e.target.checked })}
                  />
                  Disponible
                </label>
              </div>

              <div className="row">
                <button type="submit" className="btn btn-primary" disabled={formLoading} data-testid="submit-btn">
                  {formLoading ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button type="button" className="btn" onClick={closeForm}>Annuler</button>
              </div>
            </form>
          </Card>
        )}

        {isLoading && <Spinner label="Chargement du menu…" />}

        {!isLoading && dishes.length === 0 && !error && <Empty>Aucun plat dans le menu. Ajoutez le premier avec « + Ajouter un plat ».</Empty>}

        {!isLoading && dishes.length > 0 && (
          <div className="table-wrap">
            <table className="data-table admin-dish-list" data-testid="dish-list">
              <thead>
                <tr>
                  <th scope="col">Plat</th>
                  <th scope="col">Catégorie</th>
                  <th scope="col" className="num">Prix</th>
                  <th scope="col">État</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {dishes.map((dish) => (
                  <tr key={dish.id} data-testid={`dish-item-${dish.id}`}>
                    <td>
                      <div className="row-actions">
                        {dish.imageUrl ? <img className="thumb" src={assetUrl(dish.imageUrl)} alt="" loading="lazy" /> : <span className="thumb-empty" aria-hidden="true">photo</span>}
                        <span>
                          <strong>{dish.name}</strong>
                          {dish.description && <small className="muted" style={{ display: 'block' }}>{dish.description}</small>}
                        </span>
                      </div>
                    </td>
                    <td>{dish.category ? (CATEGORY_LABEL[dish.category] ?? dish.category) : '—'}</td>
                    <td className="num">{formatPrice(dish.priceFc)}</td>
                    <td>
                      <div className="row-actions">
                        <Badge kind={dish.isAvailable ? 'success' : 'error'}>{dish.isAvailable ? 'Disponible' : 'Épuisé'}</Badge>
                        {dish.isDaily && <Badge kind="info">Plat du jour</Badge>}
                      </div>
                    </td>
                    <td>
                      <div className="row-actions">
                        {confirmingId === dish.id
                          ? <>
                            <button type="button" className="btn btn-danger" onClick={() => void handleDelete(dish)} data-testid={`confirm-delete-${dish.id}`}>Oui, retirer</button>
                            <button type="button" className="btn" onClick={() => setConfirmingId(null)}>Non</button>
                          </>
                          : <>
                            <button type="button" className="btn" onClick={() => startEdit(dish)} aria-label={`Modifier ${dish.name}`}>Modifier</button>
                            <button type="button" className="btn" onClick={() => setConfirmingId(dish.id)} aria-label={`Supprimer ${dish.name}`} data-testid={`delete-${dish.id}`}>Supprimer</button>
                          </>}
                      </div>
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
