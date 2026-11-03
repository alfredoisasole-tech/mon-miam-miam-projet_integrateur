import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { paymentApi, type PaymentOutcome } from '../../controllers/payment';
import { RequireRole } from '../components/RequireRole';

export const PaymentReturnPage: React.FC = () => {
  const { paymentId } = useParams<{ paymentId: string }>();
  const navigate = useNavigate();
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<'paid' | 'failed' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSimulate = async (outcome: PaymentOutcome) => {
    if (!paymentId) return;
    setIsProcessing(true);
    setError(null);
    
    try {
      const response = await paymentApi.simulatePayment(paymentId, outcome);
      setResult(response.status as 'paid' | 'failed');
    } catch (err: any) {
      setError(err?.message || 'Une erreur est survenue lors de la simulation du paiement.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <RequireRole allowedRoles={['student']}>
      <div className="payment-return-page" data-testid="payment-return-page">
        <h2>Simulation de Paiement</h2>
        <p>Identifiant du paiement : <strong>{paymentId}</strong></p>

        {!result && !error && (
          <div className="simulation-actions" data-testid="simulation-actions">
            <p>Ceci est une page de simulation. Choisissez le résultat du paiement :</p>
            <div className="button-group" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button 
                onClick={() => handleSimulate('paid')} 
                disabled={isProcessing}
                data-testid="btn-simulate-paid"
                style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                {isProcessing ? 'Traitement...' : '✅ Simuler un Paiement Réussi'}
              </button>
              <button 
                onClick={() => handleSimulate('failed')} 
                disabled={isProcessing}
                data-testid="btn-simulate-failed"
                style={{ padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                {isProcessing ? 'Traitement...' : '❌ Simuler un Échec'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="error-message" role="alert" data-testid="payment-error" style={{ color: '#ef4444', marginTop: '1rem' }}>
            <p>Erreur : {error}</p>
            <button onClick={() => navigate('/mes-commandes')} style={{ marginTop: '0.5rem' }}>Retour à mes commandes</button>
          </div>
        )}

        {result === 'paid' && (
          <div className="success-message" data-testid="payment-success" style={{ marginTop: '1rem', color: '#10b981' }}>
            <h3>✅ Paiement reçu !</h3>
            <p>Votre commande a été confirmée et est en cours de préparation.</p>
            <button onClick={() => navigate('/mes-commandes')} style={{ marginTop: '0.5rem', padding: '0.5rem 1rem' }}>Voir mes commandes</button>
          </div>
        )}

        {result === 'failed' && (
          <div className="failed-message" data-testid="payment-failed" style={{ marginTop: '1rem', color: '#ef4444' }}>
            <h3>❌ Paiement échoué</h3>
            <p>Le paiement n'a pas pu aboutir. Vous pouvez réessayer ou annuler la commande.</p>
            <div className="button-group" style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button onClick={() => setResult(null)} style={{ padding: '0.5rem 1rem' }}>Réessayer</button>
              <button onClick={() => navigate('/mes-commandes')} style={{ padding: '0.5rem 1rem' }}>Retourner au panier</button>
            </div>
          </div>
        )}
      </div>
    </RequireRole>
  );
};