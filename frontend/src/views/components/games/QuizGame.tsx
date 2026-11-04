import { useState } from 'react';

export interface Question { question: string; options: string[]; answer: number; explanation: string }

export const QUESTIONS: Question[] = [
  { question: 'Le pondu est préparé avec des feuilles de quelle plante ?', options: ['Manioc', 'Épinard', 'Chou'], answer: 0,
    explanation: 'Le pondu se fait avec des feuilles de manioc pilées, longuement mijotées.' },
  { question: 'Que mange-t-on souvent avec le poulet à la moambe ?', options: ['Des frites de banane uniquement', 'Du riz ou de la chikwangue', 'Des pâtes'], answer: 1,
    explanation: 'La sauce moambe, à base de noix de palme, accompagne souvent le riz ou la chikwangue.' },
  { question: 'La chikwangue est une pâte de…', options: ['Maïs', 'Manioc', 'Igname'], answer: 1,
    explanation: 'La chikwangue est une pâte de manioc fermentée, cuite dans des feuilles.' },
  { question: 'Le « liboke » désigne un plat…', options: ['Frit dans l’huile', 'Cuit à l’étouffée dans des feuilles', 'Servi cru'], answer: 1,
    explanation: 'Le liboke est un plat (souvent du poisson) cuit à l’étouffée dans des feuilles.' },
  { question: 'Le fufu (foufou) est préparé à partir de…', options: ['Farine de manioc ou de maïs', 'Pommes de terre', 'Lentilles'], answer: 0,
    explanation: 'Le fufu est une pâte épaisse obtenue en délayant de la farine de manioc ou de maïs dans l’eau chaude.' },
];

/** Quiz sur la cuisine de Kinshasa. Jeu local : aucun point n'est en jeu. */
export function QuizGame() {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const finished = index >= QUESTIONS.length;

  if (finished) return <section aria-labelledby="game-quiz">
    <h3 id="game-quiz">Quiz cuisine de Kinshasa</h3>
    <p role="status">Votre score : {score} / {QUESTIONS.length}</p>
    <button type="button" className="btn btn-primary" onClick={() => { setIndex(0); setPicked(null); setScore(0); }}>Rejouer</button>
  </section>;

  const current = QUESTIONS[index];
  const answered = picked !== null;
  function pick(option: number) {
    if (answered) return;
    setPicked(option);
    if (option === current.answer) setScore(value => value + 1);
  }
  return <section aria-labelledby="game-quiz">
    <h3 id="game-quiz">Quiz cuisine de Kinshasa</h3>
    <p className="muted">Question {index + 1} sur {QUESTIONS.length}</p>
    <p><strong>{current.question}</strong></p>
    <div className="game-options">
      {current.options.map((option, i) => <button key={option} type="button" className="btn" disabled={answered} onClick={() => pick(i)}
        aria-pressed={picked === i}>{option}</button>)}
    </div>
    {answered && <>
      <p role="status">{picked === current.answer ? 'Bonne réponse ! ' : 'Pas tout à fait. '}{current.explanation}</p>
      <button type="button" className="btn btn-primary" onClick={() => { setIndex(index + 1); setPicked(null); }}>
        {index + 1 === QUESTIONS.length ? 'Voir le score' : 'Question suivante'}
      </button>
    </>}
  </section>;
}
