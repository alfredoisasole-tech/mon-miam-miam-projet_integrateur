import { useState } from 'react';
import { useAuth, useRestaurant } from '../../controllers/session.tsx';
import { useStats } from '../../controllers/stats.ts';
import type { StatsPeriod, StatsState } from '../../controllers/stats.ts';
import { formatPrice } from '../../models/format.ts';
import { Alert, Card, Empty, Spinner, Tabs } from '../components/ui.tsx';
import './stats.css';

export function StatsView({ period, onPeriodChange, state, onRefresh }: {
  period: StatsPeriod; onPeriodChange: (period: StatsPeriod) => void; state: StatsState; onRefresh: () => void;
}) {
  const { data, error, refreshing, updatedAt } = state;
  const items = data ? [...data.topItems].sort((a, b) => b.quantity - a.quantity) : [];
  const max = Math.max(1, ...items.map(item => item.quantity));
  const content = <div className="stack" aria-busy={refreshing}>
    {error && <Alert>{error}{data && ' Les valeurs précédentes sont conservées ; elles peuvent être anciennes.'}</Alert>}
    {!data && refreshing && <Spinner label="Chargement des statistiques…" />}
    {data && <>
      <div className="stats-summary">
        <Card title="Ventes"><p className="stat-value">{formatPrice(data.salesFc)}</p><p className="muted">Commandes terminées uniquement</p></Card>
        <Card title="Commandes"><p className="stat-value">{data.orders.total}</p><p className="muted">{data.orders.completed} terminées · {data.orders.active} en cours · {data.orders.cancelled} annulées</p></Card>
        <Card title="Panier moyen"><p className="stat-value">{formatPrice(Math.round(data.averageOrderFc))}</p><p className="muted">Montant moyen en FC</p></Card>
      </div>
      <Card title="Plats les plus vendus">
        {items.length === 0 ? <Empty>Aucune vente sur cette période.</Empty> : <ol className="stats-ranking">
          {items.map((item, index) => <li key={`${item.name}-${index}`}>
            <div className="stats-item"><span>{item.name}</span><strong>{item.quantity} {item.quantity === 1 ? 'portion' : 'portions'}</strong></div>
            <div className="stats-track" aria-hidden="true"><span style={{ width: `${item.quantity / max * 100}%` }} /></div>
          </li>)}
        </ol>}
      </Card>
    </>}
    {updatedAt && <p className="muted stats-updated">Dernière mise à jour : <time dateTime={updatedAt.toISOString()}>{updatedAt.toLocaleTimeString('fr-FR', { timeZone: 'Africa/Kinshasa', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time> · Heure de Kinshasa{refreshing && ' · Actualisation…'}</p>}
  </div>;
  return <>
    <div className="stats-heading"><div><p className="eyebrow">Activité du restaurant</p><h1>Statistiques</h1><p className="muted">Suivez les ventes et les plats préférés de vos clients.</p></div>
      <button type="button" className="btn-primary" onClick={onRefresh} disabled={refreshing}>Actualiser</button>
    </div>
    <p className="muted">Actualisation automatique toutes les 30 secondes.</p>
    <Tabs<StatsPeriod> label="Période des statistiques" value={period} onChange={onPeriodChange} options={[
      { id: 'day', label: 'Aujourd’hui', content: period === 'day' ? content : null },
      { id: 'week', label: 'Semaine', content: period === 'week' ? content : null },
      { id: 'month', label: 'Mois', content: period === 'month' ? content : null },
    ]} />
  </>;
}

export function StatsPage() {
  const [period, setPeriod] = useState<StatsPeriod>('day');
  const { user } = useAuth();
  const { slug } = useRestaurant();
  const state = useStats(period, `${user?.id ?? ''}:${slug ?? ''}`);
  return <StatsView period={period} onPeriodChange={setPeriod} state={state} onRefresh={state.refresh} />;
}
