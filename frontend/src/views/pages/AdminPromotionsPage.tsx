import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { adminApi } from '../../controllers/admin.ts';
import { MAX_LOGO_BYTES, settingsApi } from '../../controllers/settings.ts';
import type { AdminPromotion } from '../../controllers/admin.ts';
import { Alert, Badge, Card, Input, Select, Spinner } from '../components/ui.tsx';

const TYPE_LABEL: Record<AdminPromotion['type'], string> = { promotion: 'Promotion', event: 'Événement', game: 'Jeu' };
const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Une erreur est survenue.');
const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR');

export function AdminPromotionsPage() {
  const [items, setItems] = useState<AdminPromotion[] | null>(null);
  const [type, setType] = useState<AdminPromotion['type']>('promotion');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [posterId, setPosterId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi.listPromotions().then(setItems).catch(e => { setItems([]); setError(messageOf(e)); });
  }, []);
  useEffect(load, [load]);

  async function run(action: () => Promise<unknown>) {
    setError(null);
    try { await action(); setConfirming(null); load(); } catch (e) { setError(messageOf(e)); setConfirming(null); }
  }
  async function onPoster(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) { setError('L’affiche dépasse 512 Ko.'); return; }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setError('L’affiche doit être une image PNG, JPEG ou WebP.'); return; }
    setError(null);
    try { setPosterId((await settingsApi.uploadAsset('poster', file)).id); } catch (e) { setError(messageOf(e)); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (!title.trim()) found.title = 'Le titre est obligatoire.';
    if (!start) found.start = 'Choisissez la date de début.';
    if (!end) found.end = 'Choisissez la date de fin.';
    else if (start && end < start) found.end = 'La fin doit être le même jour ou après le début.';
    setErrors(found);
    if (Object.keys(found).length) return;
    await run(async () => {
      await adminApi.createPromotion({
        type, title: title.trim(), ...(description.trim() ? { description: description.trim() } : {}),
        startDate: `${start}T00:00:00.000Z`, endDate: `${end}T23:59:59.000Z`,
        ...(posterId ? { imageAssetId: posterId } : {}),
      });
      setTitle(''); setDescription(''); setStart(''); setEnd(''); setPosterId(null);
    });
  }

  return <section>
    <h1>Promotions, événements et jeux</h1>
    <Alert>{error}</Alert>
    <Card title="Nouvelle publication">
      <form onSubmit={submit} noValidate>
        <Select label="Type" value={type} onChange={e => setType(e.target.value as AdminPromotion['type'])}>
          {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Input label="Titre" value={title} error={errors.title} onChange={e => setTitle(e.target.value)} />
        <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} />
        <Input label="Affiche" type="file" accept="image/png,image/jpeg,image/webp" hint="PNG, JPEG ou WebP, 512 Ko au plus" onChange={e => void onPoster(e.target.files?.[0])} />
        {posterId && <p className="muted">Une affiche est jointe.</p>}
        <Input label="Début" type="date" value={start} error={errors.start} onChange={e => setStart(e.target.value)} />
        <Input label="Fin" type="date" value={end} error={errors.end} onChange={e => setEnd(e.target.value)} />
        <button type="submit" className="btn btn-primary">Créer</button>
      </form>
    </Card>
    <h2>Publications du restaurant</h2>
    {items === null ? <Spinner /> : items.map(item => <article key={item.id} className="card" aria-label={item.title}>
      <h3>{item.title} <Badge kind="neutral">{TYPE_LABEL[item.type]}</Badge> {!item.isActive && <Badge kind="error">Désactivée</Badge>}</h3>
      {item.description && <p>{item.description}</p>}
      <p className="muted">Du {day(item.startDate)} au {day(item.endDate)}</p>
      <button type="button" className="btn" aria-label={`${item.isActive ? 'Désactiver' : 'Activer'} ${item.title}`}
        onClick={() => void run(() => adminApi.updatePromotion(item.id, { isActive: !item.isActive }))}>{item.isActive ? 'Désactiver' : 'Activer'}</button>
      {confirming === item.id
        ? <>
          <button type="button" className="btn btn-danger" onClick={() => void run(() => adminApi.deletePromotion(item.id))}>Oui, supprimer</button>
          <button type="button" className="btn" onClick={() => setConfirming(null)}>Non</button>
        </>
        : <button type="button" className="btn" aria-label={`Supprimer ${item.title}`} onClick={() => setConfirming(item.id)}>Supprimer</button>}
    </article>)}
  </section>;
}
