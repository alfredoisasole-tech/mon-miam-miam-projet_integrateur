import { useCallback, useEffect, useState } from 'react';
import { KIND_LABEL, claimsApi } from '../../controllers/claims.ts';
import type { ClaimStatus, Decision, StaffClaim } from '../../controllers/claims.ts';
import { useAuth } from '../../controllers/session.tsx';
import { Alert, Badge, Empty, Input, Select, Spinner, Tabs } from '../components/ui.tsx';

type Filter = 'all' | ClaimStatus;
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Toutes' }, { id: 'open', label: 'À traiter' }, { id: 'pending_validation', label: 'À valider' }, { id: 'resolved', label: 'Traitées' },
];
const STATUS_LABEL: Record<ClaimStatus, string> = { open: 'À traiter', pending_validation: 'À valider', resolved: 'Traitée' };
const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Une erreur est survenue.');

function ClaimCard({ claim, role, onChanged }: { claim: StaffClaim; role: string; onChanged: () => void }) {
  const [decision, setDecision] = useState<Decision>('accept');
  const [response, setResponse] = useState('');
  const [note, setNote] = useState('');
  const [granted, setGranted] = useState(String(claim.requestedPoints ?? ''));
  const [error, setError] = useState<string | null>(null);
  const supervisor = role === 'manager' || role === 'admin';
  const pointsAccepted = claim.kind === 'points' && claim.proposedDecision === 'accept';
  const mustBeAdmin = claim.kind === 'points' && role !== 'admin';

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try { await action(); onChanged(); } catch (e) { setError(messageOf(e)); }
  }
  function validate() {
    if (!pointsAccepted) return run(() => claimsApi.validate(claim.id, undefined));
    const value = Number(granted);
    if (!/^\d+$/.test(granted) || value < 1 || value > (claim.requestedPoints ?? 0)) {
      setError(`Les points accordés doivent être entre 1 et ${claim.requestedPoints}.`);
      return Promise.resolve();
    }
    return run(() => claimsApi.validate(claim.id, value));
  }

  return <article className="card" aria-label={claim.subject}>
    <header>
      <h3>{claim.subject}</h3>
      <Badge kind={claim.status === 'resolved' ? 'success' : claim.status === 'open' ? 'info' : 'neutral'}>{STATUS_LABEL[claim.status]}</Badge>
      <span className="muted"> {claim.student.name} · {claim.student.phone} · {KIND_LABEL[claim.kind]}{claim.requestedPoints ? ` · ${claim.requestedPoints} points demandés` : ''}</span>
    </header>
    <p>{claim.message}</p>
    <Alert>{error}</Alert>
    {claim.managerNote && claim.status === 'open' && <Alert kind="info">Note du gérant : {claim.managerNote}</Alert>}

    {claim.status === 'open' && <form onSubmit={event => { event.preventDefault(); void run(() => claimsApi.propose(claim.id, decision, response.trim())); }}>
      <Select label="Décision proposée" value={decision} onChange={e => setDecision(e.target.value as Decision)}>
        <option value="accept">Accepter</option><option value="refuse">Refuser</option>
      </Select>
      <Input label="Réponse à l’étudiant" value={response} onChange={e => setResponse(e.target.value)} hint="5 à 500 caractères" />
      <button type="submit" className="btn btn-primary" disabled={response.trim().length < 5}>Proposer</button>
    </form>}

    {claim.status === 'pending_validation' && <div>
      <p><strong>Proposition :</strong> {claim.proposedDecision === 'accept' ? 'accepter' : 'refuser'} — {claim.proposedResponse}</p>
      {!supervisor && <p className="muted">En attente de la validation du gérant.</p>}
      {supervisor && mustBeAdmin && <p className="muted">Une réclamation de points est validée par l’administrateur.</p>}
      {supervisor && !mustBeAdmin && pointsAccepted && <Input label="Points accordés" type="number" min={1} max={claim.requestedPoints ?? undefined} value={granted} onChange={e => setGranted(e.target.value)} />}
      {supervisor && !mustBeAdmin && <button type="button" className="btn btn-primary" onClick={() => void validate()}>Valider</button>}
      {supervisor && <>
        <Input label="Note pour l’employé" value={note} onChange={e => setNote(e.target.value)} hint="5 à 500 caractères" />
        <button type="button" className="btn" disabled={note.trim().length < 5} onClick={() => void run(() => claimsApi.reject(claim.id, note.trim()))}>Renvoyer</button>
      </>}
    </div>}

    {claim.status === 'resolved' && <p><strong>Réponse envoyée :</strong> {claim.response}</p>}
  </article>;
}

export function StaffClaimsPage() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const [claims, setClaims] = useState<StaffClaim[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    claimsApi.staffList(filter === 'all' ? undefined : filter)
      .then(data => { setClaims(data); setError(null); })
      .catch(e => setError(messageOf(e)));
  }, [filter]);
  useEffect(() => {
    load();
    const timer = window.setInterval(load, 30000);
    return () => window.clearInterval(timer);
  }, [load]);

  return <section>
    <h1>Réclamations</h1>
    <Tabs label="Filtrer par état" value={filter} options={FILTERS} onChange={value => { setClaims(null); setFilter(value); }} />
    <Alert>{error}</Alert>
    {claims === null ? (error ? null : <Spinner />) : claims.length === 0 ? <Empty>Aucune réclamation dans cette catégorie.</Empty> :
      claims.map(claim => <ClaimCard key={claim.id} claim={claim} role={user?.role ?? ''} onChanged={load} />)}
  </section>;
}
