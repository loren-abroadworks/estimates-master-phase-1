import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AcceptEstimateModal } from './AcceptEstimateModal';

const base = {
  isOpen: true, onClose: vi.fn(), terms: 'Pay half up front', onEdit: vi.fn(),
};

describe('AcceptEstimateModal', () => {
  it('shows the single total and accepts with no package id when no packages given', () => {
    const onAccept = vi.fn();
    render(<AcceptEstimateModal {...base} total={500} onAccept={onAccept} />);
    expect(screen.getByTestId('accept-total')).toHaveTextContent('$500.00');
    expect(screen.queryByText(/choose your package/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^accept estimate$/i }));
    expect(onAccept).toHaveBeenCalledWith(undefined);
  });

  it('renders a chooser, follows the chosen package total, and accepts with its id', () => {
    const onAccept = vi.fn();
    render(
      <AcceptEstimateModal
        {...base}
        total={697}
        onAccept={onAccept}
        packages={[{ id: 'a', name: 'Standard', total: 697 }, { id: 'b', name: 'Premium', total: 881 }]}
        defaultPackageId="a"
      />,
    );
    expect(screen.getByText(/choose your package/i)).toBeInTheDocument();
    // defaults to 'a'
    expect(screen.getByTestId('accept-total')).toHaveTextContent('$697.00');
    fireEvent.click(screen.getByRole('radio', { name: /Premium/ }));
    expect(screen.getByTestId('accept-total')).toHaveTextContent('$881.00');
    fireEvent.click(screen.getByRole('button', { name: /^accept estimate$/i }));
    expect(onAccept).toHaveBeenCalledWith('b');
  });
});
