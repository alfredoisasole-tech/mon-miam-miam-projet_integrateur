import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { paymentApi } from '../../controllers/payment.ts';
import { Alert, Card } from '../components/ui.tsx';

/**
 * Page de paiement simulé : elle remplace l'écran de l'opérateur Mobile Money quand le serveur utilise le
 * fournisseur de simulation (essais, démonstrations). Aucun argent n'est débité ; l'utilisateur choisit le résultat.
 */
export function SimulatedPaymentPage() {
  const { paymentId = '' } = useParams();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(outcome: 'paid' | 'failed') {
    setBusy(true);
    setError(null);
    try {
      await paymentApi.simulate(paymentId, outcome);
      navigate(`/orders?paiement=${outcome === 'paid' ? 'succes' : 'erreur'}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La simulation du paiement a échoué.');
      setBusy(false);
    }
  }

  return <section className="simulated-payment">
    <h1>Paiement Mobile Money (simulation)</h1>
    <Alert kind="info">Mode démonstration : aucun argent n’est débité. Choisissez le résultat que l’opérateur renverrait.</Alert>
    <Card title="Confirmation sur le téléphone">
      <p>Sur un vrai paiement, l’opérateur demanderait ici votre code secret sur votre téléphone.</p>
      <div className="order-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void finish('paid')}>Approuver le paiement</button>
        <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void finish('failed')}>Simuler un échec</button>
        <button type="button" className="btn" disabled={busy} onClick={() => navigate('/orders?paiement=annule', { replace: true })}>Annuler</button>
      </div>
      <Alert>{error}</Alert>
    </Card>
    <p className="muted"><Link to="/orders">Retour à mes commandes</Link></p>
  </section>;
}
