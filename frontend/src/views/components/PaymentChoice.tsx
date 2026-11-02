import React from 'react';

export type PaymentMethod = 'cash' | 'mobile_money';

interface PaymentChoiceProps {
  selectedMethod: PaymentMethod | null;
  onChange: (method: PaymentMethod) => void;
  disabled?: boolean;
}

export const PaymentChoice: React.FC<PaymentChoiceProps> = ({ 
  selectedMethod, 
  onChange, 
  disabled = false 
}) => {
  return (
    <fieldset 
      className="payment-choice" 
      disabled={disabled}
      data-testid="payment-choice-fieldset"
    >
      <legend className="payment-legend">Mode de paiement</legend>
      
      <div className="payment-options">
        <label className={`payment-option ${selectedMethod === 'cash' ? 'selected' : ''}`}>
          <input
            type="radio"
            name="payment-method"
            value="cash"
            checked={selectedMethod === 'cash'}
            onChange={() => onChange('cash')}
            data-testid="radio-cash"
          />
          <span>💵 Espèces (à la livraison)</span>
        </label>

        <label className={`payment-option ${selectedMethod === 'mobile_money' ? 'selected' : ''}`}>
          <input
            type="radio"
            name="payment-method"
            value="mobile_money"
            checked={selectedMethod === 'mobile_money'}
            onChange={() => onChange('mobile_money')}
            data-testid="radio-mobile-money"
          />
          <span>📱 Mobile Money (Airtel, M-Pesa, Orange)</span>
        </label>
      </div>
    </fieldset>
  );
};