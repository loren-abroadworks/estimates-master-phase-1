import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShiftList } from './ShiftList';
import type { JobCrewAllocation, CrewMember } from '../../../types';

const staff = [{ id: 'm1', name: 'Mike Smith', role: 'Painter' }] as CrewMember[];
const shift = (over: Partial<JobCrewAllocation> = {}): JobCrewAllocation => ({
  id: 'a1', name: 'Crew', memberIds: ['m1'],
  startDate: '2026-08-17', endDate: '2026-08-18', startTime: '08:00', endTime: '17:00',
  ...over,
});

const renderList = (allocations: JobCrewAllocation[]) =>
  render(<ShiftList allocations={allocations} allStaff={staff} weekendDays={[0, 6]}
    onEditMembers={vi.fn()} onAddShift={vi.fn()} onDeleteShift={vi.fn()} />);

describe('ShiftList — a pinned shift is history', () => {
  it('badges a pinned shift as worked', () => {
    renderList([shift({ id: 'a1-worked', pinned: true })]);
    expect(screen.getByText('Worked')).toBeInTheDocument();
  });

  it('offers no edit or delete control on a pinned shift', () => {
    renderList([shift({ id: 'a1-worked', pinned: true })]);
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete shift/i })).not.toBeInTheDocument();
  });

  it('leaves an ordinary shift fully editable', () => {
    renderList([shift()]);
    expect(screen.queryByText('Worked')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete shift/i })).toBeInTheDocument();
  });

  it('renders a pinned and a live shift side by side', () => {
    renderList([shift({ id: 'a1-worked', pinned: true }), shift({ id: 'a1', startDate: '2026-08-24', endDate: '2026-08-24' })]);
    expect(screen.getAllByText('Worked')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /delete shift/i })).toHaveLength(1);
  });
});
