import type { PaymentOperator } from '../../controllers/payment.ts';

/** Africell n'est pas pris en charge par Easypay : il n'est pas proposé. */
export const PAYMENT_OPERATORS: Array<{ value: PaymentOperator; label: string }> = [
  { value: 'mpesa', label: 'M-Pesa (Vodacom)' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'airtel_money', label: 'Airtel Money' },
];

/** Accepte « 0991429583 », « 991429583 » ou « +243991429583 » et renvoie « +243991429583 ». */
export function normalizePaymentPhone(value: string): string {
  const digits = value.replace(/[\s.-]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.startsWith('243')) return `+${digits}`;
  return `+243${digits.replace(/^0/, '')}`;
}

export const isValidPaymentPhone = (value: string) => /^\+[1-9]\d{7,14}$/.test(normalizePaymentPhone(value));

interface PaymentDetailsProps {
  operator: PaymentOperator;
  phone: string;
  onOperatorChange: (operator: PaymentOperator) => void;
  onPhoneChange: (phone: string) => void;
  error?: string | null;
  idPrefix?: string;
}

export function PaymentDetails({ operator, phone, onOperatorChange, onPhoneChange, error, idPrefix = 'pay' }: PaymentDetailsProps) {
  return <div className="payment-details">
    <label className="field-label" htmlFor={`${idPrefix}-operator`}>Opérateur Mobile Money</label>
    <select id={`${idPrefix}-operator`} value={operator} onChange={e => onOperatorChange(e.target.value as PaymentOperator)}>
      {PAYMENT_OPERATORS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
    </select>
    <label className="field-label" htmlFor={`${idPrefix}-phone`}>Numéro Mobile Money</label>
    <input id={`${idPrefix}-phone`} type="tel" inputMode="tel" placeholder="+243…" value={phone}
      aria-invalid={error ? true : undefined} onChange={e => onPhoneChange(e.target.value)} />
    <p className="muted">Vous serez redirigé vers la page de paiement sécurisée d’Easypay.</p>
    {error && <p role="alert" className="field-error">{error}</p>}
  </div>;
}
