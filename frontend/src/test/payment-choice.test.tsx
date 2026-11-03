import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PaymentChoice } from '../views/components/PaymentChoice';

describe('PaymentChoice Component', () => {
  it('affiche les deux options de paiement', () => {
    render(<PaymentChoice selectedMethod={null} onChange={() => {}} />);
    
    expect(screen.getByTestId('radio-cash')).toBeInTheDocument();
    expect(screen.getByTestId('radio-mobile-money')).toBeInTheDocument();
    
    expect(screen.getByText(/Espèces/)).toBeInTheDocument();
    expect(screen.getByText(/Mobile Money/)).toBeInTheDocument();
  });

  it('appelle onChange avec "cash" quand on clique sur espèces', () => {
    const handleChange = vi.fn();
    render(<PaymentChoice selectedMethod={null} onChange={handleChange} />);
    
    fireEvent.click(screen.getByTestId('radio-cash'));
    expect(handleChange).toHaveBeenCalledWith('cash');
  });

  it('appelle onChange avec "mobile_money" quand on clique sur mobile money', () => {
    const handleChange = vi.fn();
    render(<PaymentChoice selectedMethod={null} onChange={handleChange} />);
    
    fireEvent.click(screen.getByTestId('radio-mobile-money'));
    expect(handleChange).toHaveBeenCalledWith('mobile_money');
  });

  it('marque l option sélectionnée comme cochée', () => {
    render(<PaymentChoice selectedMethod="mobile_money" onChange={() => {}} />);
    
    const radio = screen.getByTestId('radio-mobile-money') as HTMLInputElement;
    expect(radio.checked).toBe(true);
  });

  it('désactive les options si la prop disabled est true', () => {
    render(<PaymentChoice selectedMethod={null} onChange={() => {}} disabled={true} />);
    
    const fieldset = screen.getByTestId('payment-choice-fieldset');
    expect(fieldset).toBeDisabled();
  });
});