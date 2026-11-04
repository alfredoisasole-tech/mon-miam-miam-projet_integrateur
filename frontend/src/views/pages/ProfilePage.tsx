import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { PASSWORD_RE, PASSWORD_RULE, accountApi } from '../../controllers/account.ts';
import { useAuth } from '../../controllers/session.tsx';
import { Alert, Card, Input, Select } from '../components/ui.tsx';
import { KINSHASA_COMMUNES } from '../../models/communes.ts';
import { normalizePhone } from '../../models/phone.ts';
import { PHONE_RE } from '../../controllers/admin.ts';
import type { ProfilePatch } from '../../controllers/account.ts';

const messageOf = (error: unknown) => (error instanceof Error ? error.message : 'Une erreur est survenue.');
type Feedback = { kind: 'error' | 'success'; text: string } | null;

export function ProfilePage() {
  const { user, login, logout, updateUser } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [nextError, setNextError] = useState<string>();
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null);
  const [dataFeedback, setDataFeedback] = useState<Feedback>(null);
  const [confirming, setConfirming] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const isStudent = user?.role === 'student';

  // Coordonnées modifiables : les valeurs de départ viennent du profil, qui peut arriver après l'affichage.
  const [infoName, setInfoName] = useState('');
  const [infoPhone, setInfoPhone] = useState('');
  const [infoCommune, setInfoCommune] = useState('');
  const [infoQuartier, setInfoQuartier] = useState('');
  const [infoAddress, setInfoAddress] = useState('');
  const [infoPassword, setInfoPassword] = useState('');
  const [infoErrors, setInfoErrors] = useState<Record<string, string>>({});
  const [infoFeedback, setInfoFeedback] = useState<Feedback>(null);
  useEffect(() => {
    setInfoName(user?.name ?? ''); setInfoPhone(user?.phone ?? ''); setInfoCommune(user?.commune ?? '');
    setInfoQuartier(user?.quartier ?? ''); setInfoAddress(user?.address ?? '');
  }, [user?.id, user?.name, user?.phone, user?.commune, user?.quartier, user?.address]);
  const phoneChanged = infoPhone.trim() !== '' && normalizePhone(infoPhone) !== (user?.phone ?? '');

  async function saveInfo(event: FormEvent) {
    event.preventDefault();
    const found: Record<string, string> = {};
    if (infoName.trim().length < 2 || infoName.trim().length > 80) found.name = 'Le nom fait entre 2 et 80 caractères.';
    if (!PHONE_RE.test(normalizePhone(infoPhone))) found.phone = 'Format attendu : +243XXXXXXXXX';
    if (phoneChanged && !infoPassword) found.password = 'Indiquez votre mot de passe actuel pour changer de numéro.';
    setInfoErrors(found);
    if (Object.keys(found).length) return;
    const patch: ProfilePatch = {};
    if (infoName.trim() !== user?.name) patch.name = infoName.trim();
    if (phoneChanged) { patch.phone = normalizePhone(infoPhone); patch.currentPassword = infoPassword; }
    if (isStudent) {
      if (infoCommune !== (user?.commune ?? '')) patch.commune = infoCommune || null;
      if (infoQuartier.trim() !== (user?.quartier ?? '')) patch.quartier = infoQuartier.trim() || null;
      if (infoAddress.trim() !== (user?.address ?? '')) patch.address = infoAddress.trim() || null;
    }
    if (Object.keys(patch).length === 0) { setInfoFeedback({ kind: 'success', text: 'Aucun changement à enregistrer.' }); return; }
    try {
      updateUser(await accountApi.updateProfile(patch));
      setInfoPassword('');
      setInfoFeedback({ kind: 'success', text: 'Vos informations sont enregistrées.' });
    } catch (e) { setInfoFeedback({ kind: 'error', text: messageOf(e) }); }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (!PASSWORD_RE.test(next)) { setNextError(PASSWORD_RULE); return; }
    setNextError(undefined);
    try {
      const { token } = await accountApi.changePassword(current, next);
      await login(token);
      setCurrent(''); setNext('');
      setPasswordFeedback({ kind: 'success', text: 'Votre mot de passe a été changé.' });
    } catch (e) { setPasswordFeedback({ kind: 'error', text: messageOf(e) }); }
  }
  async function exportData() {
    try { await accountApi.exportData(); setDataFeedback({ kind: 'success', text: 'Vos données ont été téléchargées.' }); }
    catch (e) { setDataFeedback({ kind: 'error', text: messageOf(e) }); }
  }
  async function deleteAccount(event: FormEvent) {
    event.preventDefault();
    setDeleteError(null);
    try { await accountApi.deleteAccount(deletePassword); logout(); }
    catch (e) { setDeleteError(messageOf(e)); }
  }

  return <section className="profile-page">
    <h1>Mon profil</h1>
    <p>{user?.name}</p>
    {user?.mustChangePassword && <Alert kind="info">Votre mot de passe est temporaire : choisissez-en un nouveau pour accéder au reste du site.</Alert>}

    <Card title="Mes informations">
      <Alert kind={infoFeedback?.kind ?? 'info'}>{infoFeedback?.text}</Alert>
      <form onSubmit={saveInfo} noValidate aria-label="Mes informations">
        <Input label="Nom" value={infoName} error={infoErrors.name} autoComplete="name" onChange={e => setInfoName(e.target.value)} />
        <Input label="Téléphone" value={infoPhone} error={infoErrors.phone} autoComplete="tel" hint="+243XXXXXXXXX ou 0XXXXXXXXX" onChange={e => setInfoPhone(e.target.value)} />
        {phoneChanged && <Input label="Mot de passe actuel" type="password" autoComplete="current-password" value={infoPassword} error={infoErrors.password}
          hint="Demandé uniquement pour changer de numéro." onChange={e => setInfoPassword(e.target.value)} />}
        {isStudent && <>
          <h3>Adresse habituelle de livraison</h3>
          <p className="muted">Elle préremplit votre panier ; vous pourrez la modifier à chaque commande.</p>
          <Select label="Commune" value={infoCommune} onChange={e => setInfoCommune(e.target.value)}>
            <option value="">Aucune</option>
            {KINSHASA_COMMUNES.map(name => <option key={name} value={name}>{name}</option>)}
          </Select>
          <Input label="Quartier" value={infoQuartier} autoComplete="address-level3" onChange={e => setInfoQuartier(e.target.value)} />
          <Input label="Adresse" value={infoAddress} autoComplete="street-address" onChange={e => setInfoAddress(e.target.value)} />
        </>}
        <p className="muted">Votre e-mail ({user?.email ?? '—'}) sert à vous connecter : il ne se modifie pas ici.</p>
        <button type="submit" className="btn btn-primary">Enregistrer mes informations</button>
      </form>
    </Card>

    <Card title="Changer mon mot de passe">
      <Alert kind={passwordFeedback?.kind ?? 'info'}>{passwordFeedback?.text}</Alert>
      <form onSubmit={changePassword} noValidate>
        <Input label="Mot de passe actuel" type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} />
        <Input label="Nouveau mot de passe" type="password" autoComplete="new-password" value={next} error={nextError} hint={PASSWORD_RULE} onChange={e => setNext(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={!current || !next}>Changer le mot de passe</button>
      </form>
    </Card>

    {isStudent && <Card title="Mes données personnelles">
      <p>Vous pouvez récupérer une copie de vos données ou supprimer votre compte. La suppression est définitive : vos informations personnelles sont effacées et vos points abandonnés.</p>
      <Alert kind={dataFeedback?.kind ?? 'info'}>{dataFeedback?.text}</Alert>
      <button type="button" className="btn" onClick={() => void exportData()}>Télécharger mes données</button>
      {!confirming
        ? <button type="button" className="btn btn-danger" onClick={() => setConfirming(true)}>Supprimer mon compte</button>
        : <form onSubmit={deleteAccount} noValidate>
          <Alert>{deleteError}</Alert>
          <Input label="Mot de passe pour confirmer" type="password" autoComplete="current-password" value={deletePassword} onChange={e => setDeletePassword(e.target.value)} />
          <button type="submit" className="btn btn-danger" disabled={!deletePassword}>Confirmer la suppression</button>
          <button type="button" className="btn" onClick={() => { setConfirming(false); setDeleteError(null); setDeletePassword(''); }}>Annuler</button>
        </form>}
    </Card>}
  </section>;
}
