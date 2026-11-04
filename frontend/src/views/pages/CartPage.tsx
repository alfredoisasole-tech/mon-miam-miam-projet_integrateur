import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../controllers/cart.tsx';
import { useAuth } from '../../controllers/session.tsx';
import { api } from '../../models/http.ts';
import { formatPrice } from '../../models/format.ts';
import { Alert, Card, Spinner } from '../components/ui.tsx';
import { PaymentChoice, type PaymentMethod } from '../components/PaymentChoice.tsx';
import { PaymentDetails, isValidPaymentPhone, normalizePaymentPhone } from '../components/PaymentDetails.tsx';
import { paymentApi, type PaymentOperator } from '../../controllers/payment.ts';

const KINSHASA_COMMUNES = [
  'Bandalungwa', 'Barumbu', 'Bumbu', 'Gombe', 'Kalamu', 'Kasa-Vubu', 'Kimbanseke',
  'Kinshasa', 'Kintambo', 'Kisenso', 'Lemba', 'Limete', 'Lingwala', 'Makala',
  'Maluku', 'Masina', 'Matete', 'Mont-Ngafula', "N'djili", "N'sele", 'Ngaba',
  'Ngaliema', 'Ngiri-Ngiri', 'Selembao',
];

export const CartPage: React.FC = () => {
  const { cart, totalFc, updateProductQuantity, removeProduct, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [orderType, setOrderType] = useState<'dine_in' | 'delivery'>('dine_in');
  const [arrivalTime, setArrivalTime] = useState('');
  const [commune, setCommune] = useState('Gombe');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [note, setNote] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<{ id: string; orderNumber: string; paymentError?: string } | null>(null);
  const [payOperator, setPayOperator] = useState<PaymentOperator>('mpesa');
  const [payPhone, setPayPhone] = useState('');
  const [payPhoneError, setPayPhoneError] = useState<string | null>(null);

  // Calcul indicatif avec réduction de points (3 000 FC max sur les plats)
  const discountFc = redeemPoints ? Math.min(3000, totalFc) : 0;
  const netTotalFc = Math.max(0, totalFc - discountFc);
  // Un total à 0 FC (payé en points) n'a rien à régler chez l'opérateur.
  const needsOnlinePayment = paymentMethod === 'mobile_money' && netTotalFc > 0;

  /** Démarre le paiement chez Easypay puis quitte le site pour sa page de paiement. */
  async function startPayment(orderId: string): Promise<string | null> {
    try {
      const payment = await paymentApi.startPayment(orderId, { operator: payOperator, phone: normalizePaymentPhone(payPhone) });
      window.location.assign(payment.redirectUrl);
      return null;
    } catch (err: unknown) {
      return err instanceof Error ? err.message : 'Le paiement n’a pas pu démarrer.';
    }
  }

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart.restaurantSlug || cart.lines.length === 0) return;

    if (!user) {
      setSubmitError('Connectez-vous pour confirmer votre commande.');
      return;
    }

    setSubmitError(null);
    setPayPhoneError(null);
    if (needsOnlinePayment && !isValidPaymentPhone(payPhone)) {
      setPayPhoneError('Indiquez un numéro Mobile Money valide, par exemple +243991234567.');
      return;
    }
    setIsSubmitting(true);

    try {
      // Génération d'une clé d'idempotence unique (entre 8 et 64 caractères)
      const idempotencyKey = `mmm-idemp-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

      let formattedArrivalTime: string | null = null;
      if (orderType === 'dine_in' && arrivalTime) {
        const [h, m] = arrivalTime.split(':').map((v) => parseInt(v, 10));
        const now = new Date();
        // Kinshasa est UTC+1
        const utcDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), (h ?? 12) - 1, m ?? 0));
        formattedArrivalTime = utcDate.toISOString();
      }

      const payload = {
        restaurant: cart.restaurantSlug,
        type: orderType,
        paymentMethod,
        arrivalTime: formattedArrivalTime,
        delivery:
          orderType === 'delivery'
            ? {
                commune,
                address: address.trim() || undefined,
                landmark: landmark.trim() || undefined,
              }
            : null,
        items: cart.lines.map((line) => ({
          menuItemId: line.id,
          quantity: line.quantity,
        })),
        redeemMeal: redeemPoints,
        note: note.trim() || undefined,
      };

      const res = await api.post<{ id: string; orderNumber: string }>('/orders', payload, {
        idempotencyKey,
      });

      clearCart();
      const paymentError = needsOnlinePayment ? await startPayment(res.id) : null;
      setConfirmedOrder({ id: res.id, orderNumber: res.orderNumber, ...(paymentError ? { paymentError } : {}) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible d’enregistrer la commande.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (confirmedOrder) {
    return (
      <div className="cart-page confirmed-order" data-testid="order-confirmed">
        <Card>
          <h2>Votre commande est enregistrée !</h2>
          <p>
            Numéro de commande : <strong>{confirmedOrder.orderNumber}</strong>
          </p>
          {confirmedOrder.paymentError && (
            <Alert>{`Le paiement n’a pas pu démarrer : ${confirmedOrder.paymentError} Vous pourrez le relancer depuis « Mes commandes ».`}</Alert>
          )}
          <p>
            {orderType === 'dine_in'
              ? 'Présentez-vous au comptoir à l’heure de retrait choisie.'
              : 'Votre commande sera livrée à l’adresse indiquée.'}
          </p>
          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem' }}>
            <Link
              to="/orders"
              style={{
                display: 'inline-block',
                padding: '0.625rem 1.25rem',
                backgroundColor: 'var(--mm-color-primary, #cfbd97)',
                color: 'var(--mm-color-secondary, #000000)',
                textDecoration: 'none',
                borderRadius: '0.375rem',
                fontWeight: 600,
              }}
            >
              Suivre ma commande
            </Link>
            <button
              type="button"
              onClick={() => {
                setConfirmedOrder(null);
                navigate('/menu');
              }}
              style={{
                padding: '0.625rem 1.25rem',
                backgroundColor: 'transparent',
                border: '1px solid #d1d5db',
                borderRadius: '0.375rem',
                cursor: 'pointer',
              }}
            >
              Retour au menu
            </button>
          </div>
        </Card>
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="cart-page empty-cart" data-testid="empty-cart">
        <h2>Votre panier</h2>
        <Card>
          <p style={{ color: '#6b7280', fontSize: '1.1rem', margin: '1rem 0' }}>
            Votre panier est vide pour le moment.
          </p>
          <Link
            to="/menu"
            style={{
              display: 'inline-block',
              padding: '0.625rem 1.25rem',
              backgroundColor: 'var(--mm-color-primary, #cfbd97)',
              color: 'var(--mm-color-secondary, #000000)',
              borderRadius: '0.375rem',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Découvrir le menu
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="cart-page" data-testid="cart-page">
      <h2>Votre panier</h2>

      {submitError && (
        <Alert kind="error">
          {submitError}
        </Alert>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem' }}>
        {/* Liste des articles */}
        <section aria-labelledby="cart-items-heading">
          <h3 id="cart-items-heading">Articles commandés</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {cart.lines.map((line) => (
              <li
                key={line.id}
                data-testid={`cart-line-${line.id}`}
                style={{
                  padding: '1rem 0',
                  borderBottom: '1px solid #e5e7eb',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <h4 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>{line.name}</h4>
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
                    {formatPrice(line.unitPriceFc)} × {line.quantity} = {formatPrice(line.unitPriceFc * line.quantity)}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (line.quantity > 1) {
                        updateProductQuantity(line.id, line.quantity - 1);
                      } else {
                        removeProduct(line.id);
                      }
                    }}
                    style={{
                      width: '2rem',
                      height: '2rem',
                      borderRadius: '0.25rem',
                      border: '1px solid #d1d5db',
                      backgroundColor: '#f9fafb',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                    }}
                    aria-label={`Diminuer la quantité de ${line.name}`}
                    data-testid={`decrement-${line.id}`}
                  >
                    −
                  </button>
                  <span style={{ minWidth: '1.5rem', textAlign: 'center', fontWeight: 600 }} data-testid={`quantity-${line.id}`}>
                    {line.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateProductQuantity(line.id, line.quantity + 1)}
                    style={{
                      width: '2rem',
                      height: '2rem',
                      borderRadius: '0.25rem',
                      border: '1px solid #d1d5db',
                      backgroundColor: '#f9fafb',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                    }}
                    aria-label={`Augmenter la quantité de ${line.name}`}
                    data-testid={`increment-${line.id}`}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeProduct(line.id)}
                    style={{
                      marginLeft: '0.5rem',
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                    }}
                    aria-label={`Supprimer ${line.name}`}
                    data-testid={`remove-${line.id}`}
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Formulaire de validation */}
        <section aria-labelledby="order-details-heading">
          <Card>
            <h3 id="order-details-heading" style={{ marginTop: 0 }}>
              Détails de la commande
            </h3>

            <form onSubmit={handleConfirmOrder}>
              {/* Type de service */}
              <fieldset style={{ border: 'none', padding: 0, marginBottom: '1.25rem' }}>
                <legend style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Mode de récupération</legend>
                <div style={{ display: 'flex', gap: '1.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="orderType"
                      value="dine_in"
                      checked={orderType === 'dine_in'}
                      onChange={() => setOrderType('dine_in')}
                      data-testid="radio-dine-in"
                    />
                    Sur place
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="orderType"
                      value="delivery"
                      checked={orderType === 'delivery'}
                      onChange={() => setOrderType('delivery')}
                      data-testid="radio-delivery"
                    />
                    Livraison
                  </label>
                </div>
              </fieldset>

              {orderType === 'dine_in' ? (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label htmlFor="arrival-time" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Heure d'arrivée souhaitée
                  </label>
                  <input
                    id="arrival-time"
                    type="time"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
                    data-testid="input-arrival-time"
                  />
                  <small style={{ color: '#6b7280' }}>Optionnel — délai recommandé : 20 min</small>
                </div>
              ) : (
                <div style={{ marginBottom: '1.25rem' }}>
                  <label htmlFor="delivery-commune" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Commune
                  </label>
                  <select
                    id="delivery-commune"
                    value={commune}
                    onChange={(e) => setCommune(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db', marginBottom: '0.75rem' }}
                    data-testid="select-commune"
                  >
                    {KINSHASA_COMMUNES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="delivery-landmark" style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem' }}>
                    Repère ou adresse
                  </label>
                  <input
                    id="delivery-landmark"
                    type="text"
                    placeholder="Bâtiment, chambre ou repère connu"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }}
                    data-testid="input-landmark"
                  />
                </div>
              )}

              {/* Choix du mode de paiement */}
              <div style={{ marginBottom: '1.25rem' }}>
                <PaymentChoice
                  selectedMethod={paymentMethod}
                  onChange={(method) => setPaymentMethod(method)}
                />
                {needsOnlinePayment && (
                  <PaymentDetails operator={payOperator} phone={payPhone} error={payPhoneError}
                    onOperatorChange={setPayOperator} onPhoneChange={setPayPhone} />
                )}
              </div>

              {/* Remise fidélité */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={redeemPoints}
                    onChange={(e) => setRedeemPoints(e.target.checked)}
                    data-testid="checkbox-loyalty-discount"
                  />
                  <span>Utiliser 15 points pour une réduction de 3 000 FC</span>
                </label>
              </div>

              {/* Récapitulatif du total */}
              <div style={{ padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span>Sous-total :</span>
                  <span>{formatPrice(totalFc)}</span>
                </div>
                {redeemPoints && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', marginBottom: '0.25rem' }}>
                    <span>Réduction fidélité :</span>
                    <span>− {formatPrice(discountFc)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '1.1rem', marginTop: '0.5rem', borderTop: '1px solid #e5e7eb', paddingTop: '0.5rem' }}>
                  <span>Total à payer :</span>
                  <span data-testid="net-total">{formatPrice(netTotalFc)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: 'var(--mm-color-primary, #cfbd97)',
                  color: 'var(--mm-color-secondary, #000000)',
                  border: 'none',
                  borderRadius: '0.375rem',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
                data-testid="confirm-order-button"
              >
                {isSubmitting ? <Spinner label="Envoi de la commande..." /> : 'Confirmer la commande'}
              </button>
            </form>
          </Card>
        </section>
      </div>
    </div>
  );
};
