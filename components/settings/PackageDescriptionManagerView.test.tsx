import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PackageDescriptionManagerView } from './PackageDescriptionManagerView';

const templates = [
  { id: 'pdt-1', name: 'Premium Interior', description: 'Premium blurb' },
  { id: 'pdt-2', name: 'Exterior', description: 'Exterior blurb' },
];

describe('PackageDescriptionManagerView', () => {
  it('renders each template name', () => {
    render(<PackageDescriptionManagerView templates={templates} onAdd={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Premium Interior')).toBeInTheDocument();
    expect(screen.getByText('Exterior')).toBeInTheDocument();
  });

  it('fires onAdd when the add button is clicked', () => {
    const onAdd = vi.fn();
    render(<PackageDescriptionManagerView templates={templates} onAdd={onAdd} onEdit={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /add description/i }));
    expect(onAdd).toHaveBeenCalled();
  });

  it('filters by search term', () => {
    render(<PackageDescriptionManagerView templates={templates} onAdd={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Exterior' } });
    expect(screen.queryByText('Premium Interior')).not.toBeInTheDocument();
    expect(screen.getByText('Exterior')).toBeInTheDocument();
  });
});
