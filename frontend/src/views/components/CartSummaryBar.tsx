import { Link } from 'react-router-dom';
import type { CartLine } from '../../models/cart.ts';
import { formatPrice } from '../../models/format.ts';

interface CartSummaryBarProps {
  lines: CartLine[];
  count: number;
  totalFc: number;
  /** Vrai quand le panier appartient à un autre restaurant que celui dont le menu est affiché. */
  otherRestaurant?: boolean;
}

/** Résumé du panier toujours visible sur le menu : ce qui a été pris et ce que cela coûte. */
export function CartSummaryBar({ lines, count, totalFc, otherRestaurant = false }: CartSummaryBarProps) {
  if (count === 0) return null;
  return <aside className="cart-summary" aria-label="Résumé du panier">
    <details>
      <summary>
        <strong>{count} {count > 1 ? 'articles' : 'article'}</strong> · {formatPrice(totalFc)}
        {otherRestaurant && <span className="muted"> (panier d’un autre restaurant)</span>}
      </summary>
      <ul className="cart-summary-lines">
        {lines.map(line => <li key={line.id}>{line.quantity} × {line.name} — {formatPrice(line.unitPriceFc * line.quantity)}</li>)}
      </ul>
    </details>
    <Link className="btn btn-primary" to="/cart">Voir le panier</Link>
  </aside>;
}
