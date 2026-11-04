import { useEffect, useState } from 'react';
import { communityApi } from '../../controllers/community.ts';
import type { Referral, TopClients, TopPeriod } from '../../controllers/community.ts';
import { useRestaurant } from '../../controllers/session.tsx';
import { formatPrice } from '../../models/format.ts';
import { Alert, Badge, Card, Empty, Spinner, Tabs } from '../components/ui.tsx';
import { HigherLowerGame } from '../components/games/HigherLowerGame.tsx';
import { MemoryGame } from '../components/games/MemoryGame.tsx';
import { QuizGame } from '../components/games/QuizGame.tsx';
import './community.css';

type Tab = 'referral' | 'top' | 'games';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'referral', label: 'Parrainage' }, { id: 'top', label: 'Top 10' }, { id: 'games', label: 'Jeux' },
];
const PERIODS: Array<[TopPeriod, string]> = [['day', 'Jour'], ['week', 'Semaine'], ['month', 'Mois']];

function ReferralTab({ slug }: { slug: string }) {
  const [data, setData] = useState<Referral | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let active = true;
    communityApi.referral(slug).then(value => { if (active) setData(value); })
      .catch(() => { if (active) setError('Impossible de charger votre parrainage.'); });
    return () => { active = false; };
  }, [slug]);
  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;
  async function copy() {
    try { await navigator.clipboard.writeText(data!.code); setCopied(true); } catch { setCopied(false); }
  }
  return <>
    <Card title="Votre code de parrainage">
      <p className="referral-code">{data.code}</p>
      <button type="button" className="btn" onClick={() => void copy()}>Copier le code</button>
      {copied && <span role="status" className="muted"> Code copié.</span>}
      <p className="muted">Un ami qui s’inscrit avec ce code et passe sa première commande d’au moins 3 000 FC vous rapporte des points.</p>
      <p>{data.totals.referees} filleul{data.totals.referees > 1 ? 's' : ''} · {data.totals.rewarded} récompensé{data.totals.rewarded > 1 ? 's' : ''} · {data.totals.pointsEarned} point{data.totals.pointsEarned > 1 ? 's' : ''} gagnés ici</p>
    </Card>
    {data.referees.length === 0 ? <Empty>Personne n’a encore utilisé votre code.</Empty> : <ul className="referee-list">
      {data.referees.map((referee, index) => <li key={`${referee.name}-${index}`}>
        <span>{referee.name}</span>
        {referee.status === 'rewarded'
          ? <Badge kind="success">{referee.rewardPoints} points{referee.rewardRestaurant ? ` · ${referee.rewardRestaurant.name}` : ''}</Badge>
          : <Badge kind="neutral">En attente de sa première commande</Badge>}
      </li>)}
    </ul>}
  </>;
}

function TopTab({ slug }: { slug: string }) {
  const [period, setPeriod] = useState<TopPeriod>('month');
  const [data, setData] = useState<TopClients | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setData(null);
    communityApi.topClients(slug, period).then(value => { if (active) { setData(value); setError(null); } })
      .catch(() => { if (active) setError('Impossible de charger le classement.'); });
    return () => { active = false; };
  }, [slug, period]);
  return <>
    <div className="period-switch" role="group" aria-label="Période du classement">
      {PERIODS.map(([id, label]) => <button key={id} type="button" className={`btn${id === period ? ' btn-primary' : ''}`} aria-pressed={id === period} onClick={() => setPeriod(id)}>{label}</button>)}
    </div>
    <Alert>{error}</Alert>
    {!data ? (error ? null : <Spinner />) : data.items.length === 0 ? <Empty>Aucune commande terminée sur cette période.</Empty> :
      <table>
        <caption>Les 10 clients qui ont le plus commandé</caption>
        <thead><tr><th scope="col">Rang</th><th scope="col">Client</th><th scope="col">Commandes</th><th scope="col">Dépense</th></tr></thead>
        <tbody>{data.items.map(item => <tr key={item.rank} className={item.isMe ? 'is-me' : undefined}>
          <td>{item.rank}</td><th scope="row">{item.name}{item.isMe && <> <Badge kind="info">vous</Badge></>}</th><td>{item.orders}</td><td>{formatPrice(item.spentFc)}</td>
        </tr>)}</tbody>
      </table>}
  </>;
}

function GamesTab() {
  return <>
    <p className="muted">Trois petits jeux pour patienter. Ils sont gratuits et ne rapportent ni ne coûtent aucun point.</p>
    <div className="games-grid">
      <Card><MemoryGame /></Card>
      <Card><QuizGame /></Card>
      <Card><HigherLowerGame /></Card>
    </div>
  </>;
}

export function CommunityPage() {
  const { slug } = useRestaurant();
  const [tab, setTab] = useState<Tab>('referral');
  return <section>
    <h1>Communauté</h1>
    <Tabs label="Communauté" value={tab} options={TABS} onChange={setTab} />
    {!slug ? <Alert kind="info">Choisissez d’abord un restaurant.</Alert> :
      tab === 'referral' ? <ReferralTab slug={slug} /> : tab === 'top' ? <TopTab slug={slug} /> : <GamesTab />}
  </section>;
}
