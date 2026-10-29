import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DishCard } from '../views/components/DishCard';

// On mock les hooks temporaires
vi.mock('../controllers/tempMocks', () => ({
  useAuth: () => ({ user: null }), // visiteur par défaut
  useCart: () => ({ add: vi.fn() }),
}));

describe('DishCard Component', () => {
  const mockDish = {
    id: '1',
    name: 'Poulet Braisé',
    description: 'Délicieux poulet avec alloco',
    priceFc: 4000,
    isAvailable: true,
  };

  it('affiche les informations du plat et le prix formaté', () => {
    render(<DishCard dish={mockDish} />);
    expect(screen.getByText('Poulet Braisé')).toBeTruthy();
    expect(screen.getByText('4 000 FC')).toBeTruthy();
  });

  it('affiche le badge Épuisé et pas de bouton Ajouter si le plat est épuisé', () => {
    render(<DishCard dish={{ ...mockDish, isAvailable: false }} />);
    expect(screen.getByTestId('epuise-badge')).toBeTruthy();
    expect(screen.queryByTestId('add-button')).toBeNull();
  });

  it('n affiche pas le bouton Ajouter pour un visiteur non connecté', () => {
    render(<DishCard dish={mockDish} />);
    expect(screen.queryByTestId('add-button')).toBeNull();
  });
});
