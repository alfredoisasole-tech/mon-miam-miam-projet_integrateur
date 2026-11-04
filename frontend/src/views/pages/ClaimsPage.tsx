import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { CLAIM_KINDS, KIND_LABEL, claimsApi } from '../../controllers/claims.ts';
import type { ClaimKind, StudentClaim } from '../../controllers/claims.ts';
import { useRestaurant } from '../../controllers/session.tsx';
import { Alert, Badge, Card, Empty, Input, Select, Spinner } from '../components/ui.tsx';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Une erreur est survenue.');
const statusKind = (status: string) => (status === 'traitée' ? 'success' : status === 'ouverte' ? 'info' : 'neutral');

export function ClaimsPage() {
  const { slug } = useRestaurant();
  const [claims, setClaims] = useState<StudentClaim[] | null>(null);
  const [kind, setKind] = useState<ClaimKind>('order');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [points, setPoints] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(() => {
    claimsApi.list().then(setClaims).catch(error => { setClaims([]); setFeedback({ kind: 'error', text: messageOf(error) }); });
  }, []);
  useEffect(load, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (subject.trim().length < 3 || subject.trim().length > 100) found.subject = 'Le sujet fait entre 3 et 100 caractères.';
    if (message.trim().length < 10 || message.trim().length > 1000) found.message = 'Le message fait entre 10 et 1 000 caractères.';
    if (kind === 'points' && points && (!/^\d+$/.test(points) || Number(points) < 1)) found.points = 'Indiquez un nombre de points entier et positif.';
    setErrors(found);
    if (Object.keys(found).length) return;
    if (!slug) { setFeedback({ kind: 'error', text: 'Choisissez d’abord un restaurant.' }); return; }
    try {
      await claimsApi.create({
        restaurant: slug, kind, subject: subject.trim(), message: message.trim(),
        ...(kind === 'points' && points ? { requestedPoints: Number(points) } : {}),
      });
      setSubject(''); setMessage(''); setPoints('');
      setFeedback({ kind: 'success', text: 'Votre réclamation est envoyée. Le restaurant vous répondra ici.' });
      load();
    } catch (error) { setFeedback({ kind: 'error', text: messageOf(error) }); }
  }

  return <section className="claims-page">
    <h1>Mes réclamations</h1>
    <Alert kind={feedback?.kind ?? 'info'}>{feedback?.text}</Alert>
    <Card title="Nouvelle réclamation">
      <form onSubmit={submit} noValidate>
        <Select label="Type" value={kind} onChange={e => setKind(e.target.value as ClaimKind)}>
          {CLAIM_KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Input label="Sujet" value={subject} error={errors.subject} onChange={e => setSubject(e.target.value)} />
        <Field2 label="Message" value={message} error={errors.message} onChange={setMessage} />
        {kind === 'points' && <Input label="Points demandés" type="number" min={1} value={points} error={errors.points} onChange={e => setPoints(e.target.value)} />}
        <button type="submit" className="btn btn-primary">Envoyer la réclamation</button>
      </form>
    </Card>
    <h2>Historique</h2>
    {claims === null ? <Spinner /> : claims.length === 0 ? <Empty>Aucune réclamation pour le moment.</Empty> :
      claims.map(claim => <article key={claim.id} className="card" aria-label={claim.subject}>
        <header>
          <h3>{claim.subject}</h3>
          <Badge kind={statusKind(claim.status)}>{claim.status}</Badge>
          <span className="muted"> {claim.restaurant.name} · {KIND_LABEL[claim.kind]} · {new Date(claim.createdAt).toLocaleDateString('fr-FR')}</span>
        </header>
        <p>{claim.message}</p>
        {claim.status === 'traitée' && claim.response && <Alert kind={claim.decision === 'accept' ? 'success' : 'info'}>Réponse du restaurant : {claim.response}</Alert>}
      </article>)}
  </section>;
}

function Field2({ label, value, error, onChange }: { label: string; value: string; error?: string; onChange: (value: string) => void }) {
  return <div className="field">
    <label className="field-label" htmlFor="claim-message">{label}</label>
    <textarea id="claim-message" rows={4} value={value} aria-invalid={error ? true : undefined} aria-describedby={error ? 'claim-message-error' : undefined} onChange={e => onChange(e.target.value)} />
    {error && <small className="field-error" id="claim-message-error">{error}</small>}
  </div>;
}
