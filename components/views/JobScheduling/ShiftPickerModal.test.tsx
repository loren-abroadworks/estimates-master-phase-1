import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ShiftPickerModal } from './ShiftPickerModal';
import type { Job } from '../../../types';

const job = {
  id: 'j1', name: 'J', allocations: [
    { id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-07-06', endDate: '2026-07-06', startTime: '08:00', endTime: '12:00' },
    { id: 's2', name: 'Finish', memberIds: ['m2'], startDate: '2026-07-08', endDate: '2026-07-08', startTime: '13:00', endTime: '17:00' },
  ],
} as unknown as Job;

describe('ShiftPickerModal', () => {
  it('lists each shift and a New shift option, and reports the pick', () => {
    const onPick = vi.fn();
    render(<ShiftPickerModal open job={job} onPick={onPick} onClose={() => {}} />);
    expect(screen.getByText('Prep')).toBeInTheDocument();
    expect(screen.getByText('Finish')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Finish'));
    expect(onPick).toHaveBeenCalledWith('s2');
  });

  it('reports a New shift pick', () => {
    const onPick = vi.fn();
    render(<ShiftPickerModal open job={job} onPick={onPick} onClose={() => {}} />);
    fireEvent.click(screen.getByText(/new shift/i));
    expect(onPick).toHaveBeenCalledWith('new');
  });

  it('renders nothing when closed', () => {
    const { container } = render(<ShiftPickerModal open={false} job={job} onPick={vi.fn()} onClose={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
