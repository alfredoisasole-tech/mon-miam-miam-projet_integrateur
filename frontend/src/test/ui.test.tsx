import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Alert, Badge, Card, Empty, Field, Input, Select, Spinner, Tabs } from '../views/components/ui.tsx';

afterEach(cleanup);

describe('Composants communs E-5', () => {
  it('Alert annonce une erreur et utilise une annonce douce pour une confirmation', () => {
    const { rerender } = render(<Alert>Le menu ne peut pas être chargé.</Alert>);
    expect(screen.getByRole('alert')).toHaveTextContent('Le menu ne peut pas être chargé.');
    rerender(<Alert kind="success">Commande enregistrée.</Alert>);
    expect(screen.getByRole('status')).toHaveTextContent('Commande enregistrée.');
    rerender(<Alert>{null}</Alert>);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('Spinner expose un libellé de chargement accessible', () => {
    render(<Spinner label="Chargement des restaurants…" />);
    expect(screen.getByRole('status')).toHaveAccessibleName('Chargement des restaurants…');
    expect(screen.getByText('Chargement des restaurants…')).toBeVisible();
  });

  it('Field relie le libellé, l’aide et l’erreur au contrôle sans perdre sa description', () => {
    render(<>
      <p id="external-help">Adresse du campus.</p>
      <Field label="Adresse de livraison" hint="Bâtiment et numéro." error="Adresse obligatoire.">
        <input id="delivery" aria-describedby="external-help" />
      </Field>
    </>);
    const field = screen.getByRole('textbox', { name: 'Adresse de livraison' });
    expect(field).toHaveAttribute('id', 'delivery');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Adresse du campus. Bâtiment et numéro. Adresse obligatoire.');
    expect(document.getElementById(field.getAttribute('aria-errormessage')!)).toHaveTextContent('Adresse obligatoire.');
  });

  it('Input conserve les attributs natifs, transmet les saisies et retire une erreur corrigée', () => {
    const onChange = vi.fn();
    const { rerender } = render(<Input label="Adresse e-mail" type="email" required error="Adresse invalide." onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Adresse e-mail' });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAccessibleDescription('Adresse invalide.');
    fireEvent.change(input, { target: { value: 'etudiant@example.test' } });
    expect(onChange).toHaveBeenCalledOnce();
    rerender(<Input label="Adresse e-mail" type="email" required onChange={onChange} />);
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
    expect(input).not.toHaveAttribute('aria-errormessage');
    expect(screen.queryByText('Adresse invalide.')).not.toBeInTheDocument();
  });

  it('plusieurs Input identiques reçoivent des identifiants distincts', () => {
    render(<><Input label="Téléphone" /><Input label="Téléphone" /></>);
    const fields = screen.getAllByRole('textbox', { name: 'Téléphone' });
    expect(fields[0].id).not.toBe(fields[1].id);
    expect(fields.every(field => field.id.length > 0)).toBe(true);
  });

  it('Select associe son erreur au menu et transmet le choix', () => {
    const onChange = vi.fn();
    render(<Select label="Restaurant" error="Choisissez un restaurant." defaultValue="" onChange={onChange}>
      <option value="">Choisir</option><option value="campus">Restaurant du campus</option>
    </Select>);
    const select = screen.getByRole('combobox', { name: 'Restaurant' });
    expect(select).toHaveAccessibleDescription('Choisissez un restaurant.');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(select, { target: { value: 'campus' } });
    expect(select).toHaveValue('campus');
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('Card expose une section nommée et garde son action utilisable', () => {
    const onClick = vi.fn();
    render(<Card title="Votre panier" actions={<button onClick={onClick}>Vider</button>}>Deux articles</Card>);
    expect(screen.getByRole('region', { name: 'Votre panier' })).toHaveTextContent('Deux articles');
    fireEvent.click(screen.getByRole('button', { name: 'Vider' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('Badge décrit le statut par du texte, sans dépendre de la couleur', () => {
    render(<Badge kind="success">Disponible</Badge>);
    expect(screen.getByText('Disponible')).toBeVisible();
  });

  it('Empty conserve son message et une action de reprise', () => {
    const retry = vi.fn();
    render(<Empty>Aucun plat disponible. <button onClick={retry}>Actualiser</button></Empty>);
    expect(screen.getByText(/Aucun plat disponible/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Actualiser' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('Tabs relie les panneaux, reste dans le formulaire et se parcourt au clavier', () => {
    const submit = vi.fn();
    function Example() {
      const [value, setValue] = useState('plats');
      return <form onSubmit={submit}><Tabs label="Carte du restaurant" value={value} onChange={setValue} options={[
        { id: 'plats', label: 'Plats', content: 'Poulet mayonnaise' },
        { id: 'boissons', label: 'Boissons', content: 'Vital’O' },
        { id: 'desserts', label: 'Desserts', content: 'Fruits' },
      ]} /></form>;
    }
    render(<Example />);
    expect(screen.getByRole('tablist')).toHaveAccessibleName('Carte du restaurant');
    const first = screen.getByRole('tab', { name: 'Plats' });
    const drinks = screen.getByRole('tab', { name: 'Boissons' });
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(drinks).toHaveAttribute('tabindex', '-1');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(drinks).toHaveFocus();
    expect(drinks).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Boissons' })).toHaveTextContent('Vital’O');
    expect(drinks.getAttribute('aria-controls')).toBe(screen.getByRole('tabpanel').id);
    fireEvent.keyDown(drinks, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Desserts' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Desserts' }), { key: 'ArrowRight' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Desserts' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Desserts' }), { key: 'Home' });
    expect(first).toHaveFocus();
    fireEvent.click(drinks);
    expect(drinks).toHaveAttribute('aria-selected', 'true');
    expect(submit).not.toHaveBeenCalled();
  });
});
