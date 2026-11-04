import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { STATUS_LABEL, canCancel, canPay, isActive, ordersApi } from '../../controllers/orders.ts';
import type { Order, OrderDetail } from '../../controllers/orders.ts';
import { paymentApi } from '../../controllers/payment.ts';
import type { PaymentOperator } from '../../controllers/payment.ts';
import { formatPrice } from '../../models/format.ts';
import { PaymentDetails, isValidPaymentPhone, normalizePaymentPhone } from '../components/PaymentDetails.tsx';
import { Alert, Badge, Empty, Spinner } from '../components/ui.tsx';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Une erreur est survenue.');
const dateTime = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const badgeKind = (status: Order['status']) => (status === 'completed' ? 'success' : status === 'cancelled' ? 'error' : 'info');

function ReviewForm({ order, onDone }: { order: Order; onDone: (rating: number, comment: string) => void }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function send() {
    setError(null);
    try { await ordersApi.review(order.id, rating, comment.trim()); onDone(rating, comment.trim()); }
    catch (e) { setError(messageOf(e)); }
  }
  return <div className="review-form">
    <Alert>{error}</Alert>
    <fieldset>
      <legend>Que pensez-vous de cette commande ?</legend>
      {[1, 2, 3, 4, 5].map(value => <label key={value} className="rating-choice">
        <input type="radio" name={`rating-${order.id}`} aria-label={`${value} sur 5`} checked={rating === value} onChange={() => setRating(value)} /> {value} ★
      </label>)}
    </fieldset>
    <label className="field-label" htmlFor={`comment-${order.id}`}>Commentaire (facultatif)</label>
    <textarea id={`comment-${order.id}`} rows={2} maxLength={500} value={comment} onChange={e => setComment(e.target.value)} />
    <button type="button" className="btn btn-primary" disabled={rating === 0} onClick={() => void send()}>Envoyer mon avis</button>
  </div>;
}

function PayForm({ order }: { order: Order }) {
  const [operator, setOperator] = useState<PaymentOperator>('mpesa');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function pay() {
    setError(null);
    if (!isValidPaymentPhone(phone)) { setError('Indiquez un numéro Mobile Money valide, par exemple +243991234567.'); return; }
    setBusy(true);
    try {
      const payment = await paymentApi.startPayment(order.id, { operator, phone: normalizePaymentPhone(phone) });
      window.location.assign(payment.redirectUrl);
    } catch (e) { setError(messageOf(e)); setBusy(false); }
  }
  return <div className="pay-form">
    <PaymentDetails idPrefix={`pay-${order.id}`} operator={operator} phone={phone} onOperatorChange={setOperator} onPhoneChange={setPhone} />
    <Alert>{error}</Alert>
    <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void pay()}>{busy ? 'Ouverture du paiement…' : `Payer ${formatPrice(order.totalFc)}`}</button>
  </div>;
}

function OrderCard({ order, onChanged }: { order: Order; onChanged: (order: Order) => void }) {
  const [paying, setPaying] = useState(false);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);

  async function track() {
    setError(null);
    try { setDetail(await ordersApi.get(order.id)); } catch (e) { setError(messageOf(e)); }
  }
  async function cancel() {
    setError(null);
    try { const updated = await ordersApi.cancel(order.id); setDetail(updated); setConfirming(false); onChanged(updated); }
    catch (e) { setError(messageOf(e)); setConfirming(false); }
  }

  return <article className="card order-card" aria-label={`Commande ${order.orderNumber}`}>
    <header className="order-header">
      <strong>{order.restaurant.name}</strong>
      <Badge kind={badgeKind(order.status)}>{STATUS_LABEL[order.status]}</Badge>
    </header>
    <p className="muted">N° {order.orderNumber} · {dateTime(order.createdAt)} · {order.type === 'delivery' ? 'Livraison' : 'Sur place'}</p>
    <ul className="order-items">
      {order.items.map(item => <li key={item.menuItemId}>{item.quantity} × {item.name}</li>)}
    </ul>
    <p>Total : <strong>{formatPrice(order.totalFc)}</strong>{order.pointsEarned > 0 && <span className="muted"> · +{order.pointsEarned} points</span>}</p>
    <Alert>{error}</Alert>

    {detail && <ol className="order-events" aria-label="Historique de la commande">
      {detail.events.map(event => <li key={`${event.status}-${event.at}`}>{STATUS_LABEL[event.status]} <span className="muted">· {dateTime(event.at)}</span></li>)}
    </ol>}

    <div className="order-actions">
      <button type="button" className="btn" onClick={() => void track()}>Suivre la commande</button>
      {canPay(order) && !paying && <button type="button" className="btn btn-primary" onClick={() => setPaying(true)}>
        {order.paymentStatus === 'unpaid' ? 'Payer par Mobile Money' : 'Reprendre le paiement'}</button>}
      {canCancel(order) && !confirming && <button type="button" className="btn" onClick={() => setConfirming(true)}>Annuler la commande</button>}
      {confirming && <>
        <span>Annuler cette commande ?</span>
        <button type="button" className="btn btn-danger" onClick={() => void cancel()}>Oui, annuler</button>
        <button type="button" className="btn" onClick={() => setConfirming(false)}>Non</button>
      </>}
    </div>
    {paying && canPay(order) && <PayForm order={order} />}

    {order.status === 'completed' && (thanks
      ? <Alert kind="success">Merci pour votre avis !</Alert>
      : order.rating !== null
        ? <p className="muted">Votre avis : {order.rating} ★ sur 5{order.comment ? ` — ${order.comment}` : ''}</p>
        : <ReviewForm order={order} onDone={(rating, comment) => { setThanks(true); onChanged({ ...order, rating, comment: comment || null }); }} />)}
  </article>;
}

export function MyOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    ordersApi.list()
      .then(page => { setOrders(page.items); setError(null); })
      .catch(() => { setError('Impossible de charger vos commandes.'); setOrders(previous => previous ?? []); });
  }, []);
  useEffect(load, [load]);
  const hasActive = orders?.some(isActive) ?? false;
  // Après un paiement, la notification d'Easypay arrive quelques secondes plus tard : on rafraîchit plus souvent.
  const awaitsPayment = orders?.some(order => order.status === 'pending' && order.paymentMethod === 'mobile_money' && order.paymentStatus === 'pending') ?? false;
  useEffect(() => {
    if (!hasActive) return;
    const timer = window.setInterval(load, awaitsPayment ? 4000 : 15000);
    return () => window.clearInterval(timer);
  }, [hasActive, awaitsPayment, load]);

  const [params] = useSearchParams();
  const paymentResult = params.get('paiement');

  function replace(updated: Order) {
    setOrders(previous => previous?.map(order => (order.id === updated.id ? { ...order, ...updated } : order)) ?? null);
  }

  return <section className="my-orders-page">
    <h1>Mes commandes</h1>
    {paymentResult === 'succes' && <Alert kind="success">Paiement reçu. Votre commande sera confirmée dès que l’opérateur nous le notifie, quelques secondes au plus.</Alert>}
    {paymentResult === 'annule' && <Alert kind="info">Paiement annulé. Votre commande reste en attente : vous pouvez payer à nouveau ou l’annuler.</Alert>}
    {paymentResult === 'erreur' && <Alert>Le paiement a échoué. Votre commande reste en attente : vous pouvez réessayer ou l’annuler.</Alert>}
    <Alert>{error}</Alert>
    {orders === null ? <Spinner label="Chargement de vos commandes…" /> : orders.length === 0 && !error
      ? <Empty>Vous n’avez pas encore passé de commande.</Empty>
      : orders.map(order => <OrderCard key={order.id} order={order} onChanged={replace} />)}
  </section>;
}
