import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, type RegisterInput } from '../models/authApi';
import { useAuth, useRestaurant } from './session';

export interface FieldError {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  acceptTerms?: string;
  form?: string;
}

const PHONE_RE = /^\+243\d{9}$/;
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export function validateRegister(input: RegisterInput): FieldError {
  const errors: FieldError = {};
  if (!input.name.trim()) errors.name = 'Le nom est requis.';
  if (!input.email.trim()) errors.email = "L'adresse e-mail est requise.";
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email)) errors.email = "L'adresse e-mail est invalide.";
  
  if (!input.phone.trim()) errors.phone = 'Le numéro est requis.';
  else if (!PHONE_RE.test(input.phone)) errors.phone = 'Format attendu : +243XXXXXXXXX';
  
  if (!input.password) errors.password = 'Le mot de passe est requis.';
  else if (!PASSWORD_RE.test(input.password)) errors.password = '8 caractères minimum, avec au moins une majuscule et un chiffre.';
  
  if (input.password !== input.confirmPassword) {
    errors.confirmPassword = 'Les mots de passe ne correspondent pas.';
  }
  
  if (!input.acceptTerms) errors.acceptTerms = 'Vous devez accepter les conditions pour continuer.';
  
  return errors;
}

export function useRegister() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { slug, setRestaurant } = useRestaurant(); // slug est de type string | null

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldError>({});

  // `chosen` : restaurant choisi dans le formulaire, prioritaire sur celui mémorisé par le site.
  async function submit(input: RegisterInput, chosen?: string | null): Promise<boolean> {
    const localErrors = validateRegister(input);
    setErrors(localErrors);
    if (Object.keys(localErrors).length > 0) return false;

    const target = chosen || slug;
    if (!target) {
      setErrors({ form: 'Aucun restaurant n’est disponible pour le moment. Réessayez dans un instant.' });
      return false;
    }

    setSubmitting(true);
    try {
      const res = await authApi.register(target, input);
      setRestaurant(target);

      // CORRECTION 2 : login() ne prend que le token. 
      // session.tsx se chargera tout seul de faire api.get("/me") pour récupérer le user.
      await login(res.token);
      
      navigate('/'); // Redirection vers le menu du restaurant
      return true;
      
    } catch (err: any) {
      if (err.status === 409) {
        setErrors({ form: 'Un compte existe déjà avec ces informations. Veuillez vous connecter.' });
      } else if (err.status === 400 && err.details && typeof err.details === 'object') {
        setErrors({ ...errors, ...(err.details as Record<string, string>) });
      } else {
        setErrors({ form: err.message || 'Erreur réseau. Vérifiez votre connexion.' });
      }
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return { submit, submitting, errors, setErrors };
}