import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PromoCard } from '../views/components/PromoCard';
import type { Promotion } from '../controllers/promotions';

describe('PromoCard Component', () => {
  const mockPromotion: Promotion = {
    id: 'promo-001',
    type: 'promotion',
    title: 'Happy Hour',
    description: '-20% sur toutes les boissons de 14h à 17h',
    imageUrl: '/api/restaurants/zeduc-space/assets/promo-happy-hour.png',
    startDate: '2026-10-27T00:00:00Z',
    endDate: '2026-11-03T23:59:59Z',
  };

  it('affiche le titre, la description et la date de fin', () => {
    render(<PromoCard promotion={mockPromotion} />);

    expect(screen.getByText('Happy Hour')).toBeInTheDocument();
    expect(screen.getByText('-20% sur toutes les boissons de 14h à 17h')).toBeInTheDocument();
    expect(screen.getByTestId('promo-end-date')).toHaveTextContent(/Jusqu'au/);
  });

  it('affiche l icone pour le type promotion', () => {
    render(<PromoCard promotion={mockPromotion} />);
    expect(screen.getByText('🔥')).toBeInTheDocument();
  });

  it('affiche l icone pour le type event', () => {
    const eventPromo: Promotion = {
      ...mockPromotion,
      type: 'event',
      title: 'Soirée Champions League',
    };
    render(<PromoCard promotion={eventPromo} />);
    expect(screen.getByText('📅')).toBeInTheDocument();
  });

  it('affiche l icone pour le type game', () => {
    const gamePromo: Promotion = {
      ...mockPromotion,
      type: 'game',
      title: 'Jeu concours',
    };
    render(<PromoCard promotion={gamePromo} />);
    expect(screen.getByText('🎮')).toBeInTheDocument();
  });

  it('a un attribut role region pour l accessibilite', () => {
    render(<PromoCard promotion={mockPromotion} />);
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('n affiche pas d image si imageUrl est null', () => {
    const promoWithoutImage: Promotion = {
      ...mockPromotion,
      imageUrl: null,
    };
    render(<PromoCard promotion={promoWithoutImage} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});