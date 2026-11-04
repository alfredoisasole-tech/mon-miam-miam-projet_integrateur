import { useState } from 'react';
import type { FormEvent } from 'react';
import { Input } from '../ui.tsx';

const secretFrom = (random: () => number) => Math.floor(random() * 100) + 1;

/** Devinez un nombre entre 1 et 100. Jeu local : aucun point n'est en jeu. */
export function HigherLowerGame({ random = Math.random }: { random?: () => number }) {
  const [secret, setSecret] = useState(() => secretFrom(random));
  const [guess, setGuess] = useState('');
  const [tries, setTries] = useState(0);
  const [hint, setHint] = useState('J’ai choisi un nombre entre 1 et 100. À vous de le trouver !');
  const [won, setWon] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = Number(guess);
    if (!/^\d+$/.test(guess) || value < 1 || value > 100) { setHint('Entrez un nombre entre 1 et 100.'); return; }
    const count = tries + 1;
    setTries(count);
    setGuess('');
    if (value === secret) { setWon(true); setHint(`Gagné en ${count} essai${count > 1 ? 's' : ''} !`); }
    else setHint(value < secret ? 'C’est plus !' : 'C’est moins !');
  }
  function restart() { setSecret(secretFrom(random)); setGuess(''); setTries(0); setWon(false); setHint('Nouvelle partie : devinez mon nombre.'); }

  return <section aria-labelledby="game-hl">
    <h3 id="game-hl">Plus ou moins</h3>
    <form onSubmit={submit} noValidate>
      <Input label="Votre nombre" type="number" inputMode="numeric" value={guess} disabled={won} onChange={e => setGuess(e.target.value)} />
      <button type="submit" className="btn btn-primary" disabled={won}>Proposer</button>
    </form>
    <p role="status">{hint}</p>
    {won && <button type="button" className="btn" onClick={restart}>Rejouer</button>}
  </section>;
}
