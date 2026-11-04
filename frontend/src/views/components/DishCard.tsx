import React from 'react';
import type { MenuDish } from '../../controllers/useMenu.ts';
import { formatPrice } from '../../models/format';

interface DishCardProps {
  dish: MenuDish;
  isStudent: boolean;
  onAdd: (dish: MenuDish) => void;
  /** Quantité de ce plat déjà dans le panier. */
  quantityInCart?: number;
}

export const DishCard: React.FC<DishCardProps> = ({ dish, isStudent, onAdd, quantityInCart = 0 }) => {
  return (
    <div className="dish-card" data-testid={`dish-${dish.id}`}>
      {dish.imageUrl && <img className="dish-photo" src={dish.imageUrl} alt={dish.name} loading="lazy" />}
      <h3>{dish.name}</h3>
      {dish.description && <p>{dish.description}</p>}
      <p className="price">{formatPrice(dish.priceFc)}</p>
      
      {!dish.isAvailable && (
        <span className="badge-epuise" data-testid="epuise-badge">Épuisé</span>
      )}

      {isStudent && quantityInCart > 0 && (
        <span className="in-cart-badge" data-testid="in-cart-badge">{quantityInCart} dans le panier</span>
      )}

      {isStudent && dish.isAvailable && (
        <button
          onClick={() => onAdd(dish)}
          data-testid="add-button"
        >
          Ajouter
        </button>
      )}
    </div>
  );
};
