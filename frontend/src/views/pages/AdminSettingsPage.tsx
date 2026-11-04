import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { DAYS, FONTS, MAX_LOGO_BYTES, settingsApi } from '../../controllers/settings.ts';
import type { Settings, SettingsPatch } from '../../controllers/settings.ts';
import { announceRestaurantUpdated } from '../../controllers/useRestaurantProfile.ts';
import { Alert, Card, Input, Select, Spinner } from '../components/ui.tsx';
import { ColorField } from '../components/ColorField.tsx';
import { LogoField } from '../components/LogoField.tsx';
import { BrandPreview } from '../components/BrandPreview.tsx';
import './settings.css';

const COLOR = /^#[\da-f]{6}$/i;
const TIME = /^\d{2}:\d{2}$/;

interface Form {
  name: string; tagline: string;
  primaryColor: string; secondaryColor: string; fontFamily: string; defaultMode: string;
  hours: Record<string, { open: string; close: string }>;
  deliveryEnabled: boolean; feeFc: string; communes: string;
  spendPerPointFc: string; pointsForReward: string; rewardValueFc: string; validityMonths: string;
}

function toForm(s: Settings): Form {
  const hours: Form['hours'] = {};
  for (const [key] of DAYS) hours[key] = { open: s.openingHours[key]?.[0]?.open ?? '', close: s.openingHours[key]?.[0]?.close ?? '' };
  return {
    name: s.restaurant.name, tagline: s.restaurant.tagline ?? '',
    primaryColor: s.brand.primaryColor, secondaryColor: s.brand.secondaryColor,
    fontFamily: s.brand.fontFamily, defaultMode: s.brand.defaultMode,
    hours, deliveryEnabled: s.delivery.enabled, feeFc: String(s.delivery.feeFc), communes: s.delivery.communes.join(', '),
    spendPerPointFc: String(s.loyalty.spendPerPointFc), pointsForReward: String(s.loyalty.pointsForReward),
    rewardValueFc: String(s.loyalty.rewardValueFc), validityMonths: String(s.loyalty.validityMonths),
  };
}
const toCommunes = (text: string) => text.split(',').map(value => value.trim()).filter(Boolean);

function validate(form: Form): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.name.trim().length < 2 || form.name.trim().length > 80) errors.name = 'Le nom doit contenir entre 2 et 80 caractères.';
  if (form.tagline.length > 120) errors.tagline = 'Le slogan fait 120 caractères au plus.';
  if (!COLOR.test(form.primaryColor)) errors.primaryColor = 'Couleur invalide : six chiffres hexadécimaux, par exemple #cfbd97.';
  if (!COLOR.test(form.secondaryColor)) errors.secondaryColor = 'Couleur invalide : six chiffres hexadécimaux, par exemple #000000.';
  for (const [key, label] of DAYS) {
    const { open, close } = form.hours[key];
    if (!open && !close) continue;
    if (!TIME.test(open) || !TIME.test(close)) errors[`hours-${key}`] = `${label} : renseignez l’ouverture et la fermeture.`;
    else if (open >= close) errors[`hours-${key}`] = `${label} : l’ouverture doit être avant la fermeture.`;
  }
  const integer = (value: string, min: number, max: number) => /^\d+$/.test(value) && Number(value) >= min && Number(value) <= max;
  if (!integer(form.feeFc, 0, 100000)) errors.feeFc = 'Entier entre 0 et 100 000.';
  if (toCommunes(form.communes).length > 30) errors.communes = '30 communes au plus.';
  if (!integer(form.spendPerPointFc, 100, 1000000)) errors.spendPerPointFc = 'Entier entre 100 et 1 000 000.';
  if (!integer(form.pointsForReward, 1, 1000)) errors.pointsForReward = 'Entier entre 1 et 1 000.';
  if (!integer(form.rewardValueFc, 100, 1000000)) errors.rewardValueFc = 'Entier entre 100 et 1 000 000.';
  if (!integer(form.validityMonths, 1, 60)) errors.validityMonths = 'Entier entre 1 et 60.';
  return errors;
}

/** Ne garde que les blocs réellement modifiés. */
function diff(initial: Form, form: Form, logoAssetId: string | null, initialLogo: string | null): SettingsPatch {
  const patch: SettingsPatch = {};
  if (form.name.trim() !== initial.name) patch.name = form.name.trim();
  if (form.tagline !== initial.tagline) patch.tagline = form.tagline.trim() || null;
  const brand: NonNullable<SettingsPatch['brand']> = {};
  if (form.primaryColor !== initial.primaryColor) brand.primaryColor = form.primaryColor.toLowerCase();
  if (form.secondaryColor !== initial.secondaryColor) brand.secondaryColor = form.secondaryColor.toLowerCase();
  if (form.fontFamily !== initial.fontFamily) brand.fontFamily = form.fontFamily;
  if (form.defaultMode !== initial.defaultMode) brand.defaultMode = form.defaultMode as 'light' | 'dark' | 'system';
  if (logoAssetId !== initialLogo) brand.logoAssetId = logoAssetId;
  if (Object.keys(brand).length) patch.brand = brand;
  if (DAYS.some(([key]) => form.hours[key].open !== initial.hours[key].open || form.hours[key].close !== initial.hours[key].close)) {
    patch.openingHours = Object.fromEntries(DAYS
      .filter(([key]) => form.hours[key].open && form.hours[key].close)
      .map(([key]) => [key, [{ open: form.hours[key].open, close: form.hours[key].close }]]));
  }
  const delivery: NonNullable<SettingsPatch['delivery']> = {};
  if (form.deliveryEnabled !== initial.deliveryEnabled) delivery.enabled = form.deliveryEnabled;
  if (form.feeFc !== initial.feeFc) delivery.feeFc = Number(form.feeFc);
  if (toCommunes(form.communes).join('|') !== toCommunes(initial.communes).join('|')) delivery.communes = toCommunes(form.communes);
  if (Object.keys(delivery).length) patch.delivery = delivery;
  const loyalty: NonNullable<SettingsPatch['loyalty']> = {};
  for (const key of ['spendPerPointFc', 'pointsForReward', 'rewardValueFc', 'validityMonths'] as const) {
    if (form[key] !== initial[key]) loyalty[key] = Number(form[key]);
  }
  if (Object.keys(loyalty).length) patch.loyalty = loyalty;
  return patch;
}

export function AdminSettingsPage() {
  const [initial, setInitial] = useState<Form | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [initialLogo, setInitialLogo] = useState<string | null>(null);
  const [logoId, setLogoId] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  function load(settings: Settings) {
    const next = toForm(settings);
    setInitial(next); setForm(next);
    setInitialLogo(settings.brand.logoAssetId); setLogoId(settings.brand.logoAssetId); setLogoUrl(settings.brand.logoUrl);
  }
  useEffect(() => {
    settingsApi.get().then(load).catch(() => setMessage({ kind: 'error', text: 'Impossible de charger les paramètres.' }));
  }, []);

  if (!form || !initial) return message ? <Alert>{message.text}</Alert> : <Spinner />;
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm({ ...form, [key]: value });

  async function onLogo(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) { setMessage({ kind: 'error', text: 'Le logo dépasse 512 Ko.' }); return; }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { setMessage({ kind: 'error', text: 'Le logo doit être une image PNG, JPEG ou WebP.' }); return; }
    try {
      const asset = await settingsApi.uploadLogo(file);
      setLogoId(asset.id); setLogoUrl(asset.url); setMessage(null);
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Envoi du logo impossible.' });
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validate(form!);
    setErrors(found);
    if (Object.keys(found).length) { setMessage({ kind: 'error', text: 'Corrigez les champs signalés.' }); return; }
    const patch = diff(initial!, form!, logoId, initialLogo);
    if (!Object.keys(patch).length) { setMessage({ kind: 'success', text: 'Aucun changement à enregistrer.' }); return; }
    setSaving(true);
    try {
      load(await settingsApi.update(patch));
      announceRestaurantUpdated();
      setMessage({ kind: 'success', text: 'Les paramètres sont enregistrés.' });
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Enregistrement impossible.' });
    } finally { setSaving(false); }
  }

  return <form className="settings-page" onSubmit={onSubmit} noValidate>
    <h1>Paramètres du restaurant</h1>
    <Alert kind={message?.kind ?? 'info'}>{message?.text}</Alert>

    <Card title="Identité et charte graphique">
      <Input label="Nom du restaurant" value={form.name} error={errors.name} onChange={e => set('name', e.target.value)} />
      <Input label="Slogan" value={form.tagline} error={errors.tagline} onChange={e => set('tagline', e.target.value)} />
      <div className="settings-row">
        <ColorField label="Couleur principale" value={form.primaryColor} error={errors.primaryColor} hint="Boutons, liens et prix." onChange={value => set('primaryColor', value)} />
        <ColorField label="Couleur secondaire" value={form.secondaryColor} error={errors.secondaryColor} hint="Bandeau en haut de chaque page." onChange={value => set('secondaryColor', value)} />
      </div>
      <div className="settings-row">
        <Select label="Police" value={form.fontFamily} onChange={e => set('fontFamily', e.target.value)}>
          {FONTS.map(font => <option key={font} value={font}>{font}</option>)}
        </Select>
        <Select label="Mode par défaut" value={form.defaultMode} onChange={e => set('defaultMode', e.target.value)}>
          <option value="light">Clair</option><option value="dark">Sombre</option><option value="system">Selon l’appareil</option>
        </Select>
      </div>
      <LogoField logoUrl={logoUrl} pending={logoId !== initialLogo} onPick={file => void onLogo(file)} onRemove={() => { setLogoId(null); setLogoUrl(null); }} />
      <BrandPreview name={form.name} logoUrl={logoUrl} primary={form.primaryColor} secondary={form.secondaryColor} fontFamily={form.fontFamily} />
    </Card>

    <Card title="Horaires d’ouverture">
      <p className="muted">Laissez vide un jour de fermeture.</p>
      {DAYS.map(([key, label]) => <div className="settings-row" key={key}>
        <Input label={`${label} ouverture`} type="time" value={form.hours[key].open} onChange={e => set('hours', { ...form.hours, [key]: { ...form.hours[key], open: e.target.value } })} />
        <Input label={`${label} fermeture`} type="time" value={form.hours[key].close} error={errors[`hours-${key}`]} onChange={e => set('hours', { ...form.hours, [key]: { ...form.hours[key], close: e.target.value } })} />
      </div>)}
    </Card>

    <Card title="Livraison">
      <label className="settings-check"><input type="checkbox" checked={form.deliveryEnabled} onChange={e => set('deliveryEnabled', e.target.checked)} /> Livraison activée</label>
      <Input label="Frais de livraison (FC)" type="number" min={0} value={form.feeFc} error={errors.feeFc} onChange={e => set('feeFc', e.target.value)} />
      <Input label="Communes desservies" value={form.communes} error={errors.communes} hint="Séparées par des virgules" onChange={e => set('communes', e.target.value)} />
    </Card>

    <Card title="Fidélité">
      <div className="settings-row">
        <Input label="Dépense pour 1 point (FC)" type="number" value={form.spendPerPointFc} error={errors.spendPerPointFc} onChange={e => set('spendPerPointFc', e.target.value)} />
        <Input label="Points pour une récompense" type="number" value={form.pointsForReward} error={errors.pointsForReward} onChange={e => set('pointsForReward', e.target.value)} />
        <Input label="Valeur de la récompense (FC)" type="number" value={form.rewardValueFc} error={errors.rewardValueFc} onChange={e => set('rewardValueFc', e.target.value)} />
        <Input label="Validité des points (mois)" type="number" value={form.validityMonths} error={errors.validityMonths} onChange={e => set('validityMonths', e.target.value)} />
      </div>
      <p className="muted">Les nouvelles règles s’appliquent aux prochaines commandes ; les points déjà gagnés gardent leur date d’expiration.</p>
    </Card>

    <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
  </form>;
}
