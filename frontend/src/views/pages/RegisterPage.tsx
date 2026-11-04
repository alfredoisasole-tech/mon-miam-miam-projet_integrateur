import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useRegister } from '../../controllers/auth';

/* TODO: Dès que Emmanuel fusionne E-5, remplacer ces éléments HTML 
   par les composants importés de '../components/ui' (Field, Input, Alert, Spinner) */

export function RegisterPage() {
  const { submit, submitting, errors } = useRegister();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referral, setReferral] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const normalizedPhone = phone.startsWith('+') ? phone : `+243${phone.replace(/\D/g, '')}`;
    
    await submit({
      name,
      email,
      phone: normalizedPhone,
      deliveryAddress: deliveryAddress.trim() || undefined,
      password,
      confirmPassword,
      acceptTerms,
      referralCode: referral.trim() || undefined,
    });
  }

  // Styles simples respectant la charte (#cfbd97 et #000000) en attendant E-5
  const inputClass = "w-full p-2 border border-gray-300 rounded mt-1 focus:outline-none focus:border-[#cfbd97]";
  const errorClass = "text-red-600 text-sm mt-1";
  const labelClass = "block text-sm font-medium text-gray-700 mt-4";

  return (
    <div className="mm-page mm-auth" style={{ maxWidth: '520px', margin: '2.5rem auto', padding: 'clamp(1rem, 4vw, 1.5rem)' }}>
      <div
        className="card"
        style={{
          padding: 'clamp(1.75rem, 5vw, 2.5rem)',
          boxShadow: 'var(--mm-shadow)',
        }}
      >
        <header className="mm-auth__header" style={{ marginBottom: '1.75rem', textAlign: 'center' }}>
          <div className="eyebrow" style={{ color: 'var(--mm-accent)', marginBottom: '0.25rem' }}>Espace Étudiant</div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--mm-text)', margin: '0 0 0.5rem' }}>
            Créez votre compte étudiant
          </h1>
          <p className="muted" style={{ fontSize: '0.925rem', margin: 0 }}>
            Tous les champs sont requis, sauf mention « facultatif ».
          </p>
        </header>

        {errors.form && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div className="alert alert-error">{errors.form}</div>
          </div>
        )}

        <form className="mm-form" onSubmit={onSubmit} noValidate style={{ display: 'grid', gap: '1.25rem' }}>
          <div className="field" style={{ margin: 0 }}>
            <label className="field-label">Nom complet</label>
            <input type="text" name="name" placeholder="Ex: Gloire Nkulu" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
            {errors.name && <p className="field-error" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>{errors.name}</p>}
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label className="field-label">Adresse e-mail</label>
            <input type="email" name="email" placeholder="etudiant@campus.cd" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
            {errors.email && <p className="field-error" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>{errors.email}</p>}
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label className="field-label">Numéro de téléphone</label>
            <small className="muted" style={{ display: 'block', marginBottom: '0.35rem' }}>Pour vous joindre au sujet de votre commande.</small>
            <input type="tel" name="phone" placeholder="+243..." value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!errors.phone} />
            {errors.phone && <p className="field-error" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>{errors.phone}</p>}
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label className="field-label">Adresse de livraison habituelle <span className="muted" style={{ fontWeight: 'normal' }}>(facultatif)</span></label>
            <small className="muted" style={{ display: 'block', marginBottom: '0.35rem' }}>Vous pourrez la modifier à chaque commande.</small>
            <input type="text" name="deliveryAddress" placeholder="Ex: Campus UNIKIN, Home 10" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
          </div>

          <div className="two" style={{ gap: '1rem' }}>
            <div className="field" style={{ margin: 0 }}>
              <label className="field-label">Mot de passe</label>
              <input type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
              {errors.password && <p className="field-error" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>{errors.password}</p>}
            </div>

            <div className="field" style={{ margin: 0 }}>
              <label className="field-label">Confirmer le mot de passe</label>
              <input type="password" name="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} aria-invalid={!!errors.confirmPassword} />
              {errors.confirmPassword && <p className="field-error" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>{errors.confirmPassword}</p>}
            </div>
          </div>
          <small className="muted" style={{ marginTop: '-0.5rem', display: 'block' }}>8 caractères minimum, une majuscule, un chiffre.</small>

          <div className="field" style={{ margin: 0 }}>
            <label className="field-label">Code de parrainage <span className="muted" style={{ fontWeight: 'normal' }}>(facultatif)</span></label>
            <small className="muted" style={{ display: 'block', marginBottom: '0.35rem' }}>Un ami vous a invité ? Saisissez son code.</small>
            <input type="text" name="referral" placeholder="Ex: MIAM-ABC12" value={referral} onChange={(e) => setReferral(e.target.value.toUpperCase())} />
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', fontSize: '0.9rem', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={acceptTerms} 
                onChange={(e) => setAcceptTerms(e.target.checked)} 
                style={{ marginTop: '0.2rem' }} 
              />
              <span>
                J'accepte les <Link to="/conditions" style={{ color: 'var(--mm-text)', fontWeight: 600 }}>conditions d'utilisation</Link> et la <Link to="/confidentialite" style={{ color: 'var(--mm-text)', fontWeight: 600 }}>politique de confidentialité</Link>.
              </span>
            </label>
            {errors.acceptTerms && <p className="field-error" style={{ margin: '0.25rem 0 0', fontSize: '0.85rem' }}>{errors.acceptTerms}</p>}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{
              width: '100%',
              marginTop: '0.75rem',
              padding: '0.85rem',
              fontSize: '1rem',
              fontWeight: 600,
              boxShadow: 'var(--mm-shadow-sm)',
            }}
          >
            {submitting ? 'Création du compte...' : 'Créer mon compte'}
          </button>

          <p className="muted" style={{ textAlign: 'center', fontSize: '0.925rem', margin: '0.5rem 0 0' }}>
            Déjà inscrit ? <Link to="/login" style={{ color: 'var(--mm-text)', fontWeight: 700 }}>Se connecter</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
