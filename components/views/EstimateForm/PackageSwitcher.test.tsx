import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PackageSwitcher } from './PackageSwitcher';

const packages = [
  { id: 'a', name: 'Standard', isRecommended: false, total: 1000 },
  { id: 'b', name: 'Premium', isRecommended: true, total: 1800 },
];

const baseProps = {
  packages, activeId: 'a',
  onSwitch: vi.fn(), onAdd: vi.fn(), onDuplicate: vi.fn(),
  onRename: vi.fn(), onDelete: vi.fn(), onToggleRecommended: vi.fn(),
};

describe('PackageSwitcher', () => {
  it('renders a tab per package with name and total', () => {
    render(<PackageSwitcher {...baseProps} />);
    expect(screen.getByText('Standard')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText(/1,800|1800/)).toBeInTheDocument();
  });

  it('marks the recommended package', () => {
    render(<PackageSwitcher {...baseProps} />);
    expect(screen.getByTestId('recommended-b')).toBeInTheDocument();
  });

  it('fires onSwitch when a non-active tab is clicked', () => {
    const onSwitch = vi.fn();
    render(<PackageSwitcher {...baseProps} onSwitch={onSwitch} />);
    fireEvent.click(screen.getByRole('button', { name: /Premium/ }));
    expect(onSwitch).toHaveBeenCalledWith('b');
  });

  it('fires onAdd when the add control is clicked', () => {
    const onAdd = vi.fn();
    render(<PackageSwitcher {...baseProps} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: /add package/i }));
    expect(onAdd).toHaveBeenCalled();
  });
});
