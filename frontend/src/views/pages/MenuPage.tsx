import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useRestaurant } from '../../controllers/session.tsx';
import { useCart } from '../../controllers/useCart.ts';
import { useMenu, type MenuDish } from '../../controllers/useMenu.ts';
import { DishCard } from '../components/DishCard';
import { PromoCard } from '../components/PromoCard';
import { CartSummaryBar } from '../components/CartSummaryBar';
import { usePromotions } from '../../controllers/promotions.ts';

export const MenuPage: React.FC = () => {
  const { slug } = useRestaurant();
  const { user } = useAuth();
  const { data: menu, isLoading, error } = useMenu(slug);
  const cart = useCart();
  const { data: promotions } = usePromotions(slug);

  const addDish = (dish: MenuDish) => {
    cart.addProduct({
      id: dish.id,
      restaurantSlug: menu?.restaurant ?? '',
      name: dish.name,
      unitPriceFc: dish.priceFc,
    });
  };

  if (!slug) return <div>
    <p>Choisissez un restaurant pour afficher son menu.</p>
    <Link className="btn btn-primary" to="/">Voir les restaurants</Link>
  </div>;
  if (isLoading) return <p>Chargement du menu...</p>;
  if (error) return <p role="alert">{error}</p>;
  if (!menu || (menu.dailyItems.length === 0 && menu.categories.length === 0)) {
    return <p>Aucun plat disponible pour le moment.</p>;
  }

  const isStudent = user?.role === 'student';
  const quantityOf = (dishId: string) => cart.cart.lines.find((line) => line.id === dishId)?.quantity ?? 0;
  return (
    <div className="menu-page">
      {promotions.length > 0 && (
        <section aria-labelledby="promotions-heading">
          <h3 id="promotions-heading">Promotions et événements</h3>
          <div className="promo-grid">
            {promotions.map((promotion) => <PromoCard key={promotion.id} promotion={promotion} />)}
          </div>
        </section>
      )}
      <h2>Notre Menu</h2>
      {menu.dailyItems.length > 0 && (
        <section aria-labelledby="daily-menu-heading">
          <h3 id="daily-menu-heading">Plats du jour</h3>
          <div className="menu-grid">
            {menu.dailyItems.map((dish) => <DishCard key={dish.id} dish={dish} isStudent={isStudent} onAdd={addDish} quantityInCart={quantityOf(dish.id)} />)}
          </div>
        </section>
      )}
      {menu.categories
        .filter((category) => category.items.length > 0) 
        .map((category) => (
          <section key={category.name} aria-label={category.name}>
            <h3>{category.name}</h3>
            <div className="menu-grid">
              {category.items.map((dish) => (
                <DishCard key={dish.id} dish={dish} isStudent={isStudent} onAdd={addDish} quantityInCart={quantityOf(dish.id)} />
              ))}
            </div>
          </section>
      ))} 
      {cart.error && <p role="alert">{cart.error}</p>}
      {isStudent && <CartSummaryBar lines={cart.cart.lines} count={cart.count} totalFc={cart.totalFc}
        otherRestaurant={cart.cart.restaurantSlug !== null && cart.cart.restaurantSlug !== menu.restaurant} />}
      {cart.pendingRestaurantChange && (
        <div role="alertdialog" aria-label="Confirmer le changement de restaurant">
          <p>Vous avez des articles dans votre panier actuel. Voulez-vous changer de restaurant ? Votre panier sera vidé.</p>
          <button onClick={cart.confirmRestaurantChange}>Confirmer le changement</button>
          <button onClick={cart.cancelRestaurantChange}>Garder le panier</button>
        </div>
      )}
    </div>
  );
};
