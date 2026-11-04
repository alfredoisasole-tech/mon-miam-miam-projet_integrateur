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
    <div
      className={`dish-card ${!dish.isAvailable ? 'is-unavailable' : ''}`}
      data-testid={`dish-${dish.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        opacity: dish.isAvailable ? 1 : 0.7,
      }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--mm-text)' }}>{dish.name}</h3>
          {!dish.isAvailable && (
            <span className="badge-epuise" data-testid="epuise-badge">Épuisé</span>
          )}
        </div>
        {dish.description && (
          <p style={{ color: 'var(--mm-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.25rem' }}>
            {dish.description}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px solid var(--mm-surface-subtle)' }}>
        <p className="price" style={{ margin: 0 }}>{formatPrice(dish.priceFc)}</p>

        {isStudent && dish.isAvailable && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onAdd(dish)}
            data-testid="add-button"
            style={{
              padding: '0.45rem 1rem',
              minHeight: '38px',
              fontSize: '0.9rem',
              borderRadius: 'var(--mm-radius-sm)',
            }}
          >
            Ajouter
          </button>
        )}
      </div>
    </div>
  );
};
