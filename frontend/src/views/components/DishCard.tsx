import React from 'react';
// ⚠️ TEMPORAIRE : on utilise les mocks en attendant G-3 et G-8 de Gloirenk17
import { useAuth, useCart } from '../../controllers/tempMocks';
import { formatPrice } from '../../models/format';

interface Dish {
  id: string;
  name: string;
  description: string;
  priceFc: number;
  isAvailable: boolean;
}

interface DishCardProps {
  dish: Dish;
}

export const DishCard: React.FC<DishCardProps> = ({ dish }) => {
  const { user } = useAuth();
  const { add } = useCart();

  const isStudent = user?.role === 'student';

  return (
    <div className="dish-card" data-testid={`dish-${dish.id}`}>
      <h3>{dish.name}</h3>
      <p>{dish.description}</p>
      <p className="price">{formatPrice(dish.priceFc)}</p>
      
      {!dish.isAvailable && (
        <span className="badge-epuise" data-testid="epuise-badge">Épuisé</span>
      )}

      {isStudent && dish.isAvailable && (
        <button 
          onClick={() => add(dish)} 
          data-testid="add-button"
        >
          Ajouter
        </button>
      )}
    </div>
  );
};