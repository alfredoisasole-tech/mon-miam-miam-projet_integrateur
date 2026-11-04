import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoyaltyRedemption } from '../views/components/LoyaltyRedemption';
import * as loyaltyModule from '../controllers/loyalty';

// On mock le hook useLoyalty pour contrôler les données renvoyées au composant
vi.mock('../controllers/loyalty', () => ({
  useLoyalty: vi.fn(),
}));

const mockedUseLoyalty = loyaltyModule.useLoyalty as ReturnType<typeof vi.fn>;

describe('LoyaltyRedemption Component (Tâche B-9)', () => {
  const mockOnDiscountApplied = vi.fn();

  beforeEach(() => {
    mockOnDiscountApplied.mockClear();
    vi.clearAllMocks();
  });

  it('affiche un message si l utilisateur n a pas assez de points', () => {
    mockedUseLoyalty.mockReturnValue({
      balance: {
        availablePoints: 9,
        canRedeem: false,
        rules: { pointsForReward: 15, rewardDiscountFc: 3000 }
      },
      isLoading: false,
    });

    render(
      <LoyaltyRedemption 
        restaurantSlug="zeduc-space" 
        totalFc={5000} 
        onDiscountApplied={mockOnDiscountApplied} 
      />
    );

    expect(screen.getByTestId('loyalty-insufficient')).toBeInTheDocument();
    expect(screen.getByText(/Il vous manque 6 points/)).toBeInTheDocument();
    expect(mockOnDiscountApplied).toHaveBeenCalledWith(0, 0);
  });

  it('affiche la case à cocher et applique la remise quand elle est cochée et que le solde est suffisant', async () => {
    mockedUseLoyalty.mockReturnValue({
      balance: {
        availablePoints: 30,
        canRedeem: true,
        rules: { pointsForReward: 15, rewardDiscountFc: 3000 }
      },
      isLoading: false,
    });

    render(
      <LoyaltyRedemption 
        restaurantSlug="zeduc-space" 
        totalFc={5000} 
        onDiscountApplied={mockOnDiscountApplied} 
      />
    );

    expect(screen.getByTestId('checkbox-use-points')).toBeInTheDocument();
    
    // Au départ, pas de remise appliquée
    expect(mockOnDiscountApplied).toHaveBeenCalledWith(0, 0);

    // L'utilisateur coche la case
    fireEvent.click(screen.getByTestId('checkbox-use-points'));

    await waitFor(() => {
      // 15 points utilisés = 3000 FC de remise
      expect(mockOnDiscountApplied).toHaveBeenCalledWith(3000, 15);
      expect(screen.getByText(/-3000 FC/)).toBeInTheDocument();
    });
  });

  it('plafonne la remise au montant total de la commande si le total est inférieur à la remise', async () => {
    mockedUseLoyalty.mockReturnValue({
      balance: {
        availablePoints: 15,
        canRedeem: true,
        rules: { pointsForReward: 15, rewardDiscountFc: 3000 }
      },
      isLoading: false,
    });

    render(
      <LoyaltyRedemption 
        restaurantSlug="zeduc-space" 
        totalFc={2000} // Total inférieur à la remise de 3000 FC
        onDiscountApplied={mockOnDiscountApplied} 
      />
    );

    fireEvent.click(screen.getByTestId('checkbox-use-points'));

    await waitFor(() => {
      // La remise ne peut pas dépasser le total (2000 FC)
      expect(mockOnDiscountApplied).toHaveBeenCalledWith(2000, 15);
      expect(screen.getByText(/-2000 FC/)).toBeInTheDocument();
    });
  });

  it('affiche un état de chargement pendant la vérification du solde', () => {
    mockedUseLoyalty.mockReturnValue({
      balance: null,
      isLoading: true,
    });

    render(
      <LoyaltyRedemption 
        restaurantSlug="zeduc-space" 
        totalFc={5000} 
        onDiscountApplied={mockOnDiscountApplied} 
      />
    );

    expect(screen.getByText('Vérification de vos points...')).toBeInTheDocument();
  });
});
