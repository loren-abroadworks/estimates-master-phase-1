import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PackagePricingTable } from './PackagePricingTable';

const packages = [
  { id: 'a', name: 'Standard', isRecommended: false, total: 697, description: 'Two coats, premium paint' },
  { id: 'b', name: 'Premium', isRecommended: true, total: 881 },
];

describe('PackagePricingTable', () => {
  it('renders a package description when present', () => {
    render(<PackagePricingTable packages={packages} selectedId="a" onSelect={vi.fn()} />);
    expect(screen.getByText('Two coats, premium paint')).toBeInTheDocument();
  });

  it('omits the description block when a package has none', () => {
    render(<PackagePricingTable packages={[packages[1]]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.queryByText('Two coats, premium paint')).not.toBeInTheDocument();
  });
});
