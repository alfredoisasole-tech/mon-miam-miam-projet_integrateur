import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../App.tsx';

afterEach(cleanup);

describe('Page principale', () => {
  it('affiche le titre « Mon Miam Miam »', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Mon Miam Miam' })).toBeTruthy();
  });

  it('contient une zone principale accessible aux lecteurs d\'écran', () => {
    render(<App />);
    expect(screen.getByRole('main')).toBeTruthy();
  });
});
