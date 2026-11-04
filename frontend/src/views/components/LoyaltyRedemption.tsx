import React, { useState, useEffect } from 'react';
import { useLoyalty } from '../../controllers/loyalty';

interface LoyaltyRedemptionProps {
  restaurantSlug: string;
  totalFc: number;
  onDiscountApplied: (discountFc: number, pointsUsed: number) => void;
}

export const LoyaltyRedemption: React.FC<LoyaltyRedemptionProps> = ({ 
  restaurantSlug, 
  totalFc, 
  onDiscountApplied 
}) => {
  const { balance, isLoading } = useLoyalty(restaurantSlug);
  const [usePoints, setUsePoints] = useState(false);

  // Recalculer la remise à chaque changement d'état ou de total
  useEffect(() => {
    if (usePoints && balance?.canRedeem) {
      // La remise est plafonnée au montant total de la commande
      const discount = Math.min(balance.rules.rewardDiscountFc, totalFc);
      // On consomme le bloc de points requis (ex: 15 points)
      const pointsUsed = balance.rules.pointsForReward; 
      onDiscountApplied(discount, pointsUsed);
    } else {
      onDiscountApplied(0, 0);
    }
  }, [usePoints, balance, totalFc, onDiscountApplied]);

  if (isLoading) {
    return <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Vérification de vos points...</p>;
  }

  if (!balance || !balance.canRedeem) {
    // ✅ APRÈS (Corrigé)
    const missingPoints = balance ? balance.rules.pointsForReward - balance.availablePoints : 15;
    return (
      <p style={{ fontSize: '0.875rem', color: '#6b7280' }} data-testid="loyalty-insufficient">
        💎 Solde : {balance?.availablePoints || 0} pts. Il vous manque {missingPoints} points pour obtenir une remise de {balance?.rules.rewardDiscountFc || 3000} FC.
      </p>
    );
  }

  return (
    <div className="loyalty-redemption" data-testid="loyalty-redemption">
      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
        <input
          type="checkbox"
          checked={usePoints}
          onChange={(e) => setUsePoints(e.target.checked)}
          data-testid="checkbox-use-points"
        />
        <span>
          💎 Utiliser {balance.rules.pointsForReward} points pour une réduction de {balance.rules.rewardDiscountFc} FC
          {usePoints && <strong> (-{Math.min(balance.rules.rewardDiscountFc, totalFc)} FC)</strong>}
        </span>
      </label> {/* ✅ CORRIGÉ : </label> au lieu de </a> */}
    </div>
  );
};