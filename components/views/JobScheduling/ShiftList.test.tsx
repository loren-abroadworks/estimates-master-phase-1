import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShiftList } from './ShiftList';
import type { Job, CrewMember } from '../../../types';

const staff: CrewMember[] = [{ id: 'm1', name: 'Mike Smith' } as CrewMember];
const job: Job = {
  id: 'j1', jobNumber: 'J-1', name: 'Ext', clientId: 'c', estimateId: 'e', address: 'x',
  stage: 'Scheduled', startDate: '2026-06-08T08:00:00', endDate: '2026-06-09T17:00:00', dateCreated: '2026-01-01',
  allocations: [{ id: 'prep', name: 'Prep', memberIds: ['m1'], startDate: '2026-06-08', endDate: '2026-06-09', startTime: '08:00', endTime: '12:00' }],
} as Job;

const noop = () => {};
const props = {
  allocations: job.allocations ?? [], allStaff: staff, weekendDays: [0, 6],
  onEditMembers: noop, onAddShift: noop, onRenameShift: noop,
  onChangeSpan: noop, onChangeDayWindow: noop, onDeleteShift: noop,
};

describe('ShiftList', () => {
  it('renders a read-only card per shift with its name and members', () => {
    render(<ShiftList {...props} />);
    expect(screen.getByText('Prep')).toBeTruthy();
    expect(screen.getByText(/Mike/)).toBeTruthy();
    // Name is no longer an editable input.
    expect(screen.queryByDisplayValue('Prep')).toBeNull();
  });

  it('shows an initials avatar beside each member name', () => {
    render(<ShiftList {...props} />);
    expect(screen.getByText('MS')).toBeTruthy();
    expect(screen.getByTitle('Mike Smith')).toBeTruthy();
  });

  it('calls onAddShift when the add button is clicked', () => {
    const onAddShift = vi.fn();
    render(<ShiftList {...props} onAddShift={onAddShift} />);
    fireEvent.click(screen.getByRole('button', { name: /add shift/i }));
    expect(onAddShift).toHaveBeenCalledOnce();
  });

  it('opens the editor via the Edit button (no separate Edit members link)', () => {
    const onEditMembers = vi.fn();
    render(<ShiftList {...props} onEditMembers={onEditMembers} />);
    expect(screen.queryByText('Edit members')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(onEditMembers).toHaveBeenCalledWith('prep');
  });

  it('falls back to a generic label for an unnamed shift', () => {
    const unnamed = { ...job.allocations![0], name: '' };
    render(<ShiftList {...props} allocations={[unnamed]} />);
    expect(screen.getByText('Shift')).toBeTruthy();
  });

  it('calls onDeleteShift with the shift id', () => {
    const onDeleteShift = vi.fn();
    render(<ShiftList {...props} onDeleteShift={onDeleteShift} />);
    fireEvent.click(screen.getByRole('button', { name: /delete shift/i }));
    expect(onDeleteShift).toHaveBeenCalledWith('prep');
  });

  it('disables delete when canDelete is false (only one shift)', () => {
    const onDeleteShift = vi.fn();
    render(<ShiftList {...props} canDelete={false} onDeleteShift={onDeleteShift} />);
    const btn = screen.getByRole('button', { name: /delete shift/i });
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onDeleteShift).not.toHaveBeenCalled();
  });
});

describe('ShiftList day rows', () => {
  it('does not list a day the shift skips', () => {
    const allocations = [{
      id: 'prep', name: 'Prep', memberIds: ['m1'],
      startDate: '2026-06-08', endDate: '2026-06-10',
      startTime: '08:00', endTime: '12:00',
      skipDays: ['2026-06-09'],
    }];
    render(<ShiftList {...props} allocations={allocations} />);
    // Match the day-ROW label ("Mon, Jun 8"), not the range header ("Jun 8 – Jun 10").
    expect(screen.getByText('Mon, Jun 8')).toBeTruthy();
    expect(screen.queryByText('Tue, Jun 9')).toBeNull();
    expect(screen.getByText('Wed, Jun 10')).toBeTruthy();
  });
});

describe('ShiftList per-member windows', () => {
  const twoStaff: CrewMember[] = [
    { id: 'm1', name: 'Mike Smith' } as CrewMember,
    { id: 'm2', name: 'Sarah Lee' } as CrewMember,
  ];
  const base = {
    id: 'prep', name: 'Prep', memberIds: ['m1', 'm2'],
    startDate: '2026-06-08', endDate: '2026-06-08',
    startTime: '08:00', endTime: '12:00',
  };

  it('keeps a day on one row when every member shares the shift window', () => {
    render(<ShiftList {...props} allStaff={twoStaff} allocations={[base]} />);
    expect(screen.getByText('8:00 AM – 12:00 PM')).toBeTruthy();
    // No per-member breakdown rows for a uniform day.
    expect(screen.queryByTestId('member-day-m1-2026-06-08')).toBeNull();
  });

  const divergent = {
    ...base,
    memberDailyWindows: { m1: { '2026-06-08': { startTime: '13:00', endTime: '17:00' } } },
  };

  it('collapses a day whose members differ, summarising the span and how many windows', () => {
    render(<ShiftList {...props} allStaff={twoStaff} allocations={[divergent]} />);
    const toggle = screen.getByRole('button', { name: /Mon, Jun 8/ });
    // The overall span runs from the earliest start to the latest end across the crew.
    expect(toggle.textContent).toContain('8:00 AM – 5:00 PM');
    expect(toggle.textContent).toContain('2 times');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // Per-member rows stay hidden until asked for.
    expect(screen.queryByTestId('member-day-m1-2026-06-08')).toBeNull();
  });

  it('reveals the per-member rows when the day is expanded', () => {
    render(<ShiftList {...props} allStaff={twoStaff} allocations={[divergent]} />);
    fireEvent.click(screen.getByRole('button', { name: /Mon, Jun 8/ }));
    const mike = screen.getByTestId('member-day-m1-2026-06-08');
    const sarah = screen.getByTestId('member-day-m2-2026-06-08');
    expect(mike.textContent).toContain('Mike');
    expect(mike.textContent).toContain('1:00 PM – 5:00 PM');
    // Sarah has no override, so she falls back to the shift's window that day.
    expect(sarah.textContent).toContain('Sarah');
    expect(sarah.textContent).toContain('8:00 AM – 12:00 PM');
    expect(screen.getByRole('button', { name: /Mon, Jun 8/ })).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapses again on a second click', () => {
    render(<ShiftList {...props} allStaff={twoStaff} allocations={[divergent]} />);
    const toggle = () => screen.getByRole('button', { name: /Mon, Jun 8/ });
    fireEvent.click(toggle());
    fireEvent.click(toggle());
    expect(screen.queryByTestId('member-day-m1-2026-06-08')).toBeNull();
  });

  it('counts distinct windows, not members', () => {
    const threeStaff = [...twoStaff, { id: 'm3', name: 'Jess Wu' } as CrewMember];
    const alloc = {
      ...base, memberIds: ['m1', 'm2', 'm3'],
      // Two members share the afternoon; one keeps the shift window. Two windows, not three.
      memberDailyWindows: {
        m1: { '2026-06-08': { startTime: '13:00', endTime: '17:00' } },
        m2: { '2026-06-08': { startTime: '13:00', endTime: '17:00' } },
      },
    };
    render(<ShiftList {...props} allStaff={threeStaff} allocations={[alloc]} />);
    expect(screen.getByRole('button', { name: /Mon, Jun 8/ }).textContent).toContain('2 times');
  });

  it('gives a uniform day no toggle to click', () => {
    render(<ShiftList {...props} allStaff={twoStaff} allocations={[base]} />);
    expect(screen.queryByRole('button', { name: /Mon, Jun 8/ })).toBeNull();
  });

  it('shows the shift window on one row for an unassigned shift', () => {
    render(<ShiftList {...props} allStaff={twoStaff} allocations={[{ ...base, memberIds: [] }]} />);
    expect(screen.getByText('8:00 AM – 12:00 PM')).toBeTruthy();
  });
});
