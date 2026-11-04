import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useRegister } from '../../controllers/auth';
import { useRestaurants } from '../../controllers/restaurants';
import { useRestaurant } from '../../controllers/session';

/* TODO: Dès que Emmanuel fusionne E-5, remplacer ces éléments HTML
   par les composants importés de '../components/ui' (Field, Input, Alert, Spinner) */

export function RegisterPage() {
  const { submit, submitting, errors } = useRegister();
  const { slug } = useRestaurant();
  const { restaurants } = useRestaurants();
  // Le compte vaut pour tous les restaurants. L'API l'enregistre quand même auprès d'un premier restaurant :
  // celui que le visiteur consultait, sinon le premier de la liste. Les autres adhésions se créent à la première commande.
  const restaurant = slug ?? restaurants[0]?.slug ?? '';

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
    }, restaurant);
  }

  // Styles simples respectant la charte (#cfbd97 et #000000) en attendant E-5
  const inputClass = "w-full p-2 border border-gray-300 rounded mt-1 focus:outline-none focus:border-[#cfbd97]";
  const errorClass = "text-red-600 text-sm mt-1";
  const labelClass = "block text-sm font-medium text-gray-700 mt-4";

  return (
    <div className="mm-page mm-auth" style={{ maxWidth: '480px', margin: '2rem auto', padding: '1.5rem' }}>
      <header className="mm-auth__header" style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#000' }}>Créez votre compte étudiant</h1>
        <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Tous les champs sont requis, sauf mention « facultatif ».
        </p>
        <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          Un seul compte pour tous les restaurants : vous choisirez où commander après votre inscription.
        </p>
      </header>

      {errors.form && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.75rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {errors.form}
        </div>
      )}

      <form className="mm-form" onSubmit={onSubmit} noValidate>
        <div>
          <label className={labelClass}>Nom complet</label>
          <input type="text" name="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} aria-invalid={!!errors.name} />
          {errors.name && <p className={errorClass}>{errors.name}</p>}
        </div>

        <div>
          <label className={labelClass}>Adresse e-mail</label>
          <input type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} aria-invalid={!!errors.email} />
          {errors.email && <p className={errorClass}>{errors.email}</p>}
        </div>

        <div>
          <label className={labelClass}>Numéro de téléphone</label>
          <p style={{ fontSize: '0.8rem', color: '#666', margin: '0.25rem 0' }}>Pour vous joindre au sujet de votre commande.</p>
          <input type="tel" name="phone" placeholder="+243..." value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} aria-invalid={!!errors.phone} />
          {errors.phone && <p className={errorClass}>{errors.phone}</p>}
        </div>

        <div>
          <label className={labelClass}>Adresse de livraison habituelle <span style={{ fontWeight: 'normal', color: '#666' }}>(facultatif)</span></label>
          <p style={{ fontSize: '0.8rem', color: '#666', margin: '0.25rem 0' }}>Vous pourrez la modifier à chaque commande.</p>
          <input type="text" name="deliveryAddress" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className={labelClass}>Mot de passe</label>
          <p style={{ fontSize: '0.8rem', color: '#666', margin: '0.25rem 0' }}>8 caractères minimum, une majuscule, un chiffre.</p>
          <input type="password" name="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} aria-invalid={!!errors.password} />
          {errors.password && <p className={errorClass}>{errors.password}</p>}
        </div>

        <div>
          <label className={labelClass}>Confirmer le mot de passe</label>
          <input type="password" name="confirmPassword" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} aria-invalid={!!errors.confirmPassword} />
          {errors.confirmPassword && <p className={errorClass}>{errors.confirmPassword}</p>}
        </div>

        <div>
          <label className={labelClass}>Code de parrainage <span style={{ fontWeight: 'normal', color: '#666' }}>(facultatif)</span></label>
          <p style={{ fontSize: '0.8rem', color: '#666', margin: '0.25rem 0' }}>Un ami vous a invité ? Saisissez son code.</p>
          <input type="text" name="referral" value={referral} onChange={(e) => setReferral(e.target.value.toUpperCase())} className={inputClass} />
        </div>

        <div style={{ marginTop: '1rem' }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.9rem' }}>
            <input 
              type="checkbox" 
              checked={acceptTerms} 
              onChange={(e) => setAcceptTerms(e.target.checked)} 
              style={{ marginTop: '0.2rem' }} 
            />
            <span>
              J'accepte les <Link to="/conditions" style={{ color: '#000', textDecoration: 'underline' }}>conditions d'utilisation</Link> et la <Link to="/confidentialite" style={{ color: '#000', textDecoration: 'underline' }}>politique de confidentialité</Link>.
            </span>
          </label>
          {errors.acceptTerms && <p className={errorClass}>{errors.acceptTerms}</p>}
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            marginTop: '1.5rem',
            padding: '0.75rem',
            background: '#cfbd97',
            color: '#000',
            border: 'none',
            borderRadius: '4px',
            fontWeight: 'bold',
            fontSize: '1rem',
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.7 : 1
          }}
        >
          {submitting ? 'Création du compte...' : 'Créer mon compte'}
        </button>

        <p style={{ textAlign: 'center', fontSize: '0.9rem', marginTop: '1.5rem' }}>
          Déjà inscrit ? <Link to="/login" style={{ color: '#000', fontWeight: 'bold' }}>Se connecter</Link>
        </p>
      </form>
    </div>
  );
}
