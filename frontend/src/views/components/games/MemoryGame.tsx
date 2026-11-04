import { useEffect, useState } from 'react';

const SYMBOLS = ['🍗', '🐟', '🍌', '🥭', '🍚', '🥤'];

function deck(random: () => number): string[] {
  const cards = SYMBOLS.flatMap(symbol => [symbol, symbol]);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

/** Mémoire des saveurs : retrouvez les six paires. Jeu local : aucun point n'est en jeu. */
export function MemoryGame({ random = Math.random }: { random?: () => number }) {
  const [cards, setCards] = useState(() => deck(random));
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const done = found.length === cards.length;

  useEffect(() => {
    if (open.length !== 2) return;
    const [a, b] = open;
    if (cards[a] === cards[b]) { setFound(previous => [...previous, a, b]); setOpen([]); return; }
    const timer = window.setTimeout(() => setOpen([]), 1000);
    return () => window.clearTimeout(timer);
  }, [open, cards]);

  function flip(index: number) {
    if (done || open.includes(index) || found.includes(index) || open.length === 2) return;
    if (open.length === 1) setMoves(value => value + 1);
    setOpen([...open, index]);
  }
  function restart() { setCards(deck(random)); setOpen([]); setFound([]); setMoves(0); }

  return <section aria-labelledby="game-memory">
    <h3 id="game-memory">Mémoire des saveurs</h3>
    <div className="memory-grid">
      {cards.map((symbol, index) => {
        const visible = open.includes(index) || found.includes(index);
        return <button key={index} type="button" className="memory-card" aria-pressed={visible}
          aria-label={visible ? `Carte ${index + 1} : ${symbol}` : `Carte ${index + 1}`} onClick={() => flip(index)}>
          <span aria-hidden="true">{visible ? symbol : '?'}</span>
        </button>;
      })}
    </div>
    <p role="status">{done ? `Bravo ! Terminé en ${moves} coups.` : `${moves} coup${moves > 1 ? 's' : ''}`}</p>
    {done && <button type="button" className="btn" onClick={restart}>Rejouer</button>}
  </section>;
}
