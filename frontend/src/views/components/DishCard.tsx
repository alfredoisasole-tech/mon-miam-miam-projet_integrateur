import React from 'react';
import type { MenuDish } from '../../controllers/useMenu.ts';
import { formatPrice } from '../../models/format';

interface DishCardProps {
  dish: MenuDish;
  isStudent: boolean;
  onAdd: (dish: MenuDish) => void;
}

export const DishCard: React.FC<DishCardProps> = ({ dish, isStudent, onAdd }) => {
  return (
    <div className="dish-card" data-testid={`dish-${dish.id}`}>
      <h3>{dish.name}</h3>
      {dish.description && <p>{dish.description}</p>}
      <p className="price">{formatPrice(dish.priceFc)}</p>
      
      {!dish.isAvailable && (
        <span className="badge-epuise" data-testid="epuise-badge">Épuisé</span>
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
