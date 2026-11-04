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
      style={{ border: 'none', padding: 0, margin: 0 }}
    >
      <legend className="payment-legend" style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.75rem', color: 'var(--mm-text)' }}>
        Mode de paiement
      </legend>
      
      <div className="payment-options" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
        <label
          className={`payment-option ${selectedMethod === 'cash' ? 'selected' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--mm-radius-sm)',
            border: `1.5px solid ${selectedMethod === 'cash' ? 'var(--mm-color-primary)' : 'var(--mm-line)'}`,
            background: selectedMethod === 'cash' ? 'var(--mm-surface-subtle)' : 'var(--mm-surface)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            fontSize: '0.925rem',
            transition: 'var(--mm-transition)',
          }}
        >
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

        <label
          className={`payment-option ${selectedMethod === 'mobile_money' ? 'selected' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            padding: '0.75rem 1rem',
            borderRadius: 'var(--mm-radius-sm)',
            border: `1.5px solid ${selectedMethod === 'mobile_money' ? 'var(--mm-color-primary)' : 'var(--mm-line)'}`,
            background: selectedMethod === 'mobile_money' ? 'var(--mm-surface-subtle)' : 'var(--mm-surface)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            fontSize: '0.925rem',
            transition: 'var(--mm-transition)',
          }}
        >
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