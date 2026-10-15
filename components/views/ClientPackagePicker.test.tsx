import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ClientPackagePicker } from './ClientPackagePicker';

const packages = [
  { id: 'a', name: 'Standard', isRecommended: false, total: 697 },
  { id: 'b', name: 'Premium', isRecommended: true, total: 881 },
];

describe('ClientPackagePicker', () => {
  it('renders a pill per package with name and formatted total', () => {
    render(<ClientPackagePicker packages={packages} selectedId="a" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Standard/ })).toHaveTextContent('$697');
    expect(screen.getByRole('button', { name: /Premium/ })).toHaveTextContent('$881');
  });

  it('marks the selected pill via aria-pressed', () => {
    render(<ClientPackagePicker packages={packages} selectedId="b" onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Premium/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Standard/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('flags the recommended package', () => {
    render(<ClientPackagePicker packages={packages} selectedId="a" onSelect={vi.fn()} />);
    expect(screen.getByTestId('pick-recommended-b')).toBeInTheDocument();
  });

  it('fires onSelect with the package id', () => {
    const onSelect = vi.fn();
    render(<ClientPackagePicker packages={packages} selectedId="a" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Premium/ }));
    expect(onSelect).toHaveBeenCalledWith('b');
  });
});
