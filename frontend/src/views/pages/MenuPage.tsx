import React from 'react';
import { useAuth, useRestaurant } from '../../controllers/session.tsx';
import { useCart } from '../../controllers/useCart.ts';
import { useMenu, type MenuDish } from '../../controllers/useMenu.ts';
import { DishCard } from '../components/DishCard';

export const MenuPage: React.FC = () => {
  const { slug } = useRestaurant();
  const { user } = useAuth();
  const { data: menu, isLoading, error } = useMenu(slug);
  const cart = useCart();

  const addDish = (dish: MenuDish) => {
    cart.addProduct({
      id: dish.id,
      restaurantSlug: menu?.restaurant ?? '',
      name: dish.name,
      unitPriceFc: dish.priceFc,
    });
  };

  if (!slug) return <p className="empty">Choisissez un restaurant pour afficher son menu.</p>;
  if (isLoading) return <p className="muted">Chargement du menu...</p>;
  if (error) return <p className="alert alert-error" role="alert">{error}</p>;
  if (!menu || (menu.dailyItems.length === 0 && menu.categories.length === 0)) {
    return <p className="empty">Aucun plat disponible pour le moment.</p>;
  }

  const isStudent = user?.role === 'student';
  return (
    <div className="menu-page" style={{ display: 'grid', gap: '2.5rem' }}>
      <header style={{ borderBottom: '1px solid var(--mm-line)', paddingBottom: '1rem' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.75rem' }}>Notre Menu</h2>
        <p className="muted" style={{ margin: 0 }}>
          Découvrez nos spécialités cuisinées le jour même sur le campus.
        </p>
      </header>

      {menu.dailyItems.length > 0 && (
        <section aria-labelledby="daily-menu-heading">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <span style={{ fontSize: '1.25rem' }}>⭐</span>
            <h3 id="daily-menu-heading" style={{ margin: 0, fontSize: '1.35rem' }}>Plats du jour</h3>
          </div>
          <div className="menu-grid">
            {menu.dailyItems.map((dish) => <DishCard key={dish.id} dish={dish} isStudent={isStudent} onAdd={addDish} />)}
          </div>
        </section>
      )}

      {menu.categories
        .filter((category) => category.items.length > 0) 
        .map((category) => (
          <section key={category.name} aria-label={category.name}>
            <h3 style={{ fontSize: '1.35rem', marginBottom: '1.25rem', paddingBottom: '0.5rem', borderBottom: '1.5px solid var(--mm-line)' }}>
              {category.name}
            </h3>
            <div className="menu-grid">
              {category.items.map((dish) => (
                <DishCard key={dish.id} dish={dish} isStudent={isStudent} onAdd={addDish} />
              ))}
            </div>
          </section>
      ))} 

      {cart.error && <p className="alert alert-error" role="alert">{cart.error}</p>}

      {cart.pendingRestaurantChange && (
        <div role="alertdialog" aria-label="Confirmer le changement de restaurant">
          <div>
            <h3 style={{ margin: '0 0 0.75rem' }}>Changer de restaurant ?</h3>
            <p style={{ color: 'var(--mm-muted)', lineHeight: 1.5, marginBottom: '1.5rem' }}>
              Vous avez des articles dans votre panier actuel. Voulez-vous changer de restaurant ? Votre panier sera vidé.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-outline" onClick={cart.cancelRestaurantChange}>
                Garder le panier
              </button>
              <button type="button" className="btn btn-primary" onClick={cart.confirmRestaurantChange}>
                Confirmer le changement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
