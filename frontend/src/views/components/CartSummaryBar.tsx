import { Link } from 'react-router-dom';
import type { CartLine } from '../../models/cart.ts';
import { formatPrice } from '../../models/format.ts';

interface CartSummaryBarProps {
  lines: CartLine[];
  count: number;
  totalFc: number;
  /** Adresse du panier de ce restaurant (`/r/<restaurant>/cart`). */
  cartPath: string;
}

/** Résumé du panier toujours visible sur le menu : ce qui a été pris et ce que cela coûte. */
export function CartSummaryBar({ lines, count, totalFc, cartPath }: CartSummaryBarProps) {
  if (count === 0) return null;
  return <aside className="cart-summary" aria-label="Résumé du panier">
    <details>
      <summary>
        <strong>{count} {count > 1 ? 'articles' : 'article'}</strong> · {formatPrice(totalFc)}
      </summary>
      <ul className="cart-summary-lines">
        {lines.map(line => <li key={line.id}>{line.quantity} × {line.name} — {formatPrice(line.unitPriceFc * line.quantity)}</li>)}
      </ul>
    </details>
    <Link className="btn btn-primary" to={cartPath}>Voir le panier</Link>
  </aside>;
}
