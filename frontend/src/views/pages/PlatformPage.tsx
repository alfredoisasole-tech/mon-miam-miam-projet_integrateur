import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { EMAIL_RE, PHONE_RE, adminApi } from '../../controllers/admin.ts';
import type { PlatformRestaurant } from '../../controllers/admin.ts';
import { PASSWORD_RE, PASSWORD_RULE } from '../../controllers/account.ts';
import { Alert, Badge, Card, Input, Spinner } from '../components/ui.tsx';

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Une erreur est survenue.');

export function PlatformPage() {
  const [restaurants, setRestaurants] = useState<PlatformRestaurant[] | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', adminName: '', adminEmail: '', adminPhone: '', adminPassword: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const load = useCallback(() => {
    adminApi.listRestaurants().then(setRestaurants).catch(e => { setRestaurants([]); setFeedback({ kind: 'error', text: messageOf(e) }); });
  }, []);
  useEffect(load, [load]);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm({ ...form, [key]: event.target.value });

  async function toggle(restaurant: PlatformRestaurant) {
    try {
      await adminApi.setRestaurantStatus(restaurant.slug, restaurant.status === 'active' ? 'inactive' : 'active');
      setFeedback({ kind: 'success', text: 'Le statut du restaurant est mis à jour.' });
      load();
    } catch (e) { setFeedback({ kind: 'error', text: messageOf(e) }); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (form.name.trim().length < 2) found.name = 'Le nom fait au moins 2 caractères.';
    if (!SLUG_RE.test(form.slug)) found.slug = 'Minuscules, chiffres et tirets uniquement, par exemple mon-restaurant.';
    if (form.adminName.trim().length < 2) found.adminName = 'Le nom fait au moins 2 caractères.';
    if (!EMAIL_RE.test(form.adminEmail)) found.adminEmail = 'Adresse e-mail invalide.';
    if (!PHONE_RE.test(form.adminPhone)) found.adminPhone = 'Format attendu : +243XXXXXXXXX';
    if (!PASSWORD_RE.test(form.adminPassword)) found.adminPassword = PASSWORD_RULE;
    setErrors(found);
    if (Object.keys(found).length) return;
    try {
      const result = await adminApi.createRestaurant({
        slug: form.slug, name: form.name.trim(),
        admin: { name: form.adminName.trim(), email: form.adminEmail.trim(), phone: form.adminPhone.trim(), password: form.adminPassword },
      });
      setFeedback({ kind: 'success', text: `Le restaurant ${result.restaurant.name} est créé avec son administrateur.` });
      setForm({ name: '', slug: '', adminName: '', adminEmail: '', adminPhone: '', adminPassword: '' });
      load();
    } catch (e) { setFeedback({ kind: 'error', text: messageOf(e) }); }
  }

  return <section>
    <h1>Restaurants de la plateforme</h1>
    <Alert kind={feedback?.kind ?? 'info'}>{feedback?.text}</Alert>
    {restaurants === null ? <Spinner /> : restaurants.map(restaurant => <article key={restaurant.slug} className="card" aria-label={restaurant.name}>
      <h3>{restaurant.name} {restaurant.status === 'active' ? <Badge kind="success">Actif</Badge> : <Badge kind="error">Désactivé</Badge>}</h3>
      <p className="muted">{restaurant.slug} · {restaurant.students} étudiant{restaurant.students > 1 ? 's' : ''}</p>
      <p>{restaurant.administrators.length === 0 ? 'Aucun administrateur' : restaurant.administrators.map(a => `${a.name} (${a.email})`).join(', ')}</p>
      <button type="button" className="btn" onClick={() => void toggle(restaurant)}>{restaurant.status === 'active' ? 'Désactiver' : 'Réactiver'}</button>
    </article>)}

    <Card title="Nouveau restaurant">
      <form onSubmit={submit} noValidate>
        <Input label="Nom du restaurant" value={form.name} error={errors.name} onChange={set('name')} />
        <Input label="Identifiant (slug)" value={form.slug} error={errors.slug} hint="Utilisé dans l’adresse du restaurant" onChange={set('slug')} />
        <Input label="Nom de l’administrateur" value={form.adminName} error={errors.adminName} onChange={set('adminName')} />
        <Input label="E-mail de l’administrateur" type="email" value={form.adminEmail} error={errors.adminEmail} onChange={set('adminEmail')} />
        <Input label="Téléphone de l’administrateur" value={form.adminPhone} error={errors.adminPhone} hint="+243XXXXXXXXX" onChange={set('adminPhone')} />
        <Input label="Mot de passe initial" type="password" autoComplete="new-password" value={form.adminPassword} error={errors.adminPassword} hint={PASSWORD_RULE} onChange={set('adminPassword')} />
        <button type="submit" className="btn btn-primary">Créer le restaurant</button>
      </form>
    </Card>
  </section>;
}
