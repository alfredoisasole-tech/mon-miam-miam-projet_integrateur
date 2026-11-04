import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../../controllers/cart.tsx';
import { useAuth } from '../../controllers/session.tsx';
import { api } from '../../models/http.ts';
import { formatPrice } from '../../models/format.ts';
import { Alert, Card, Spinner } from '../components/ui.tsx';
import { PaymentChoice, type PaymentMethod } from '../components/PaymentChoice.tsx';

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
  const [confirmedOrder, setConfirmedOrder] = useState<{ id: string; orderNumber: string } | null>(null);

  // Calcul indicatif avec réduction de points (3 000 FC max sur les plats)
  const discountFc = redeemPoints ? Math.min(3000, totalFc) : 0;
  const netTotalFc = Math.max(0, totalFc - discountFc);

  const handleConfirmOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart.restaurantSlug || cart.lines.length === 0) return;

    if (!user) {
      setSubmitError('Connectez-vous pour confirmer votre commande.');
      return;
    }

    setSubmitError(null);
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
      setConfirmedOrder({ id: res.id, orderNumber: res.orderNumber });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Impossible d’enregistrer la commande.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (confirmedOrder) {
    return (
      <div className="cart-page confirmed-order" data-testid="order-confirmed" style={{ maxWidth: '600px', margin: '2rem auto' }}>
        <Card>
          <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h2 style={{ fontSize: '1.75rem', marginBottom: '0.75rem' }}>Votre commande est enregistrée !</h2>
            <p style={{ fontSize: '1.1rem', color: 'var(--mm-muted)', marginBottom: '1.5rem' }}>
              Numéro de commande : <strong style={{ color: 'var(--mm-text)', fontSize: '1.25rem' }}>{confirmedOrder.orderNumber}</strong>
            </p>
            <div
              style={{
                background: 'var(--mm-surface-subtle)',
                padding: '1.25rem',
                borderRadius: 'var(--mm-radius-sm)',
                marginBottom: '2rem',
                border: '1px solid var(--mm-line)',
              }}
            >
              <p style={{ margin: 0, color: 'var(--mm-text)', fontWeight: 500 }}>
                {orderType === 'dine_in'
                  ? 'Présentez-vous au comptoir à l’heure de retrait choisie.'
                  : 'Votre commande sera livrée à l’adresse indiquée.'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link
                to="/orders"
                className="btn btn-primary"
                style={{ padding: '0.75rem 1.5rem' }}
              >
                Suivre ma commande
              </Link>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  setConfirmedOrder(null);
                  navigate('/menu');
                }}
              >
                Retour au menu
              </button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="cart-page empty-cart" data-testid="empty-cart" style={{ maxWidth: '540px', margin: '2rem auto' }}>
        <h2 style={{ marginBottom: '1.5rem' }}>Votre panier</h2>
        <div className="empty">
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🛒</div>
          <p style={{ color: 'var(--mm-muted)', fontSize: '1.1rem', marginBottom: '1.5rem' }}>
            Votre panier est vide pour le moment.
          </p>
          <Link
            to="/menu"
            className="btn btn-primary"
            style={{ padding: '0.75rem 1.5rem' }}
          >
            Découvrir le menu
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page" data-testid="cart-page" style={{ maxWidth: '1060px', margin: '0 auto' }}>
      <header style={{ borderBottom: '1px solid var(--mm-line)', paddingBottom: '1rem', marginBottom: '2rem' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.75rem' }}>Votre panier</h2>
        <p className="muted" style={{ margin: 0 }}>
          Vérifiez vos articles, choisissez votre mode de service et finalisez votre commande.
        </p>
      </header>

      {submitError && (
        <div style={{ marginBottom: '1.5rem' }}>
          <Alert kind="error">
            {submitError}
          </Alert>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'start' }}>
        {/* Liste des articles */}
        <section aria-labelledby="cart-items-heading">
          <Card>
            <div className="card-head">
              <h3 id="cart-items-heading" style={{ margin: 0, fontSize: '1.25rem' }}>Articles commandés</h3>
              <span className="badge badge-neutral">{cart.lines.reduce((acc, l) => acc + l.quantity, 0)} articles</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {cart.lines.map((line) => (
                <li
                  key={line.id}
                  data-testid={`cart-line-${line.id}`}
                  style={{
                    padding: '1.1rem 0',
                    borderBottom: '1px solid var(--mm-line)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '1rem',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h4 style={{ margin: '0 0 0.35rem', fontSize: '1.05rem', color: 'var(--mm-text)' }}>{line.name}</h4>
                    <p style={{ margin: 0, color: 'var(--mm-muted)', fontSize: '0.9rem' }}>
                      {formatPrice(line.unitPriceFc)} × {line.quantity} = <strong>{formatPrice(line.unitPriceFc * line.quantity)}</strong>
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
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
                        width: '2.25rem',
                        height: '2.25rem',
                        minHeight: '2.25rem',
                        padding: 0,
                        borderRadius: 'var(--mm-radius-sm)',
                        border: '1px solid var(--mm-line)',
                        backgroundColor: 'var(--mm-surface-subtle)',
                        color: 'var(--mm-text)',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
                      }}
                      aria-label={`Diminuer la quantité de ${line.name}`}
                      data-testid={`decrement-${line.id}`}
                    >
                      −
                    </button>
                    <span style={{ minWidth: '1.75rem', textAlign: 'center', fontWeight: 700, fontSize: '1rem' }} data-testid={`quantity-${line.id}`}>
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateProductQuantity(line.id, line.quantity + 1)}
                      style={{
                        width: '2.25rem',
                        height: '2.25rem',
                        minHeight: '2.25rem',
                        padding: 0,
                        borderRadius: 'var(--mm-radius-sm)',
                        border: '1px solid var(--mm-line)',
                        backgroundColor: 'var(--mm-surface-subtle)',
                        color: 'var(--mm-text)',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '1.1rem',
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
                        color: 'var(--mm-danger)',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        padding: '0.35rem 0.5rem',
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
          </Card>
        </section>

        {/* Formulaire de validation */}
        <section aria-labelledby="order-details-heading">
          <Card>
            <h3 id="order-details-heading" style={{ marginTop: 0, marginBottom: '1.25rem', fontSize: '1.25rem' }}>
              Détails de la commande
            </h3>

            <form onSubmit={handleConfirmOrder}>
              {/* Type de service */}
              <fieldset style={{ border: 'none', padding: 0, marginBottom: '1.5rem' }}>
                <legend style={{ fontWeight: 600, marginBottom: '0.75rem', fontSize: '0.95rem' }}>Mode de récupération</legend>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      cursor: 'pointer',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--mm-radius-sm)',
                      border: `1.5px solid ${orderType === 'dine_in' ? 'var(--mm-color-primary)' : 'var(--mm-line)'}`,
                      background: orderType === 'dine_in' ? 'var(--mm-surface-subtle)' : 'var(--mm-surface)',
                      fontWeight: 600,
                      transition: 'var(--mm-transition)',
                    }}
                  >
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
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.65rem',
                      cursor: 'pointer',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--mm-radius-sm)',
                      border: `1.5px solid ${orderType === 'delivery' ? 'var(--mm-color-primary)' : 'var(--mm-line)'}`,
                      background: orderType === 'delivery' ? 'var(--mm-surface-subtle)' : 'var(--mm-surface)',
                      fontWeight: 600,
                      transition: 'var(--mm-transition)',
                    }}
                  >
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
                <div style={{ marginBottom: '1.5rem' }}>
                  <label htmlFor="arrival-time" style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                    Heure d'arrivée souhaitée
                  </label>
                  <input
                    id="arrival-time"
                    type="time"
                    value={arrivalTime}
                    onChange={(e) => setArrivalTime(e.target.value)}
                    data-testid="input-arrival-time"
                  />
                  <small style={{ color: 'var(--mm-muted)', display: 'block', marginTop: '0.25rem' }}>Optionnel — délai recommandé : 20 min</small>
                </div>
              ) : (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label htmlFor="delivery-commune" style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                    Commune
                  </label>
                  <select
                    id="delivery-commune"
                    value={commune}
                    onChange={(e) => setCommune(e.target.value)}
                    style={{ marginBottom: '1rem' }}
                    data-testid="select-commune"
                  >
                    {KINSHASA_COMMUNES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>

                  <label htmlFor="delivery-landmark" style={{ display: 'block', fontWeight: 600, marginBottom: '0.35rem', fontSize: '0.9rem' }}>
                    Repère ou adresse
                  </label>
                  <input
                    id="delivery-landmark"
                    type="text"
                    placeholder="Bâtiment, chambre ou repère connu"
                    value={landmark}
                    onChange={(e) => setLandmark(e.target.value)}
                    data-testid="input-landmark"
                  />
                </div>
              )}

              {/* Choix du mode de paiement */}
              <div style={{ marginBottom: '1.5rem' }}>
                <PaymentChoice
                  selectedMethod={paymentMethod}
                  onChange={(method) => setPaymentMethod(method)}
                />
              </div>

              {/* Remise fidélité */}
              <div
                style={{
                  marginBottom: '1.5rem',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--mm-radius-sm)',
                  background: 'var(--mm-surface-subtle)',
                  border: '1px solid var(--mm-line)',
                }}
              >
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={redeemPoints}
                    onChange={(e) => setRedeemPoints(e.target.checked)}
                    data-testid="checkbox-loyalty-discount"
                  />
                  <span style={{ fontSize: '0.925rem', fontWeight: 600 }}>
                    Utiliser 15 points pour une réduction de 3 000 FC
                  </span>
                </label>
              </div>

              {/* Récapitulatif du total */}
              <div
                style={{
                  padding: '1.25rem',
                  backgroundColor: 'var(--mm-surface-subtle)',
                  border: '1px solid var(--mm-line)',
                  borderRadius: 'var(--mm-radius-sm)',
                  marginBottom: '1.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'var(--mm-muted)' }}>
                  <span>Sous-total :</span>
                  <span style={{ fontWeight: 600, color: 'var(--mm-text)' }}>{formatPrice(totalFc)}</span>
                </div>
                {redeemPoints && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--mm-ok)', marginBottom: '0.5rem', fontWeight: 600 }}>
                    <span>Réduction fidélité :</span>
                    <span>− {formatPrice(discountFc)}</span>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 'bold',
                    fontSize: '1.2rem',
                    marginTop: '0.75rem',
                    borderTop: '1px solid var(--mm-line)',
                    paddingTop: '0.75rem',
                    color: 'var(--mm-text)',
                  }}
                >
                  <span>Total à payer :</span>
                  <span data-testid="net-total" style={{ color: 'var(--mm-brand)' }}>{formatPrice(netTotalFc)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn btn-primary"
                style={{
                  width: '100%',
                  padding: '0.85rem 1.25rem',
                  fontSize: '1.05rem',
                  boxShadow: 'var(--mm-shadow-sm)',
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
