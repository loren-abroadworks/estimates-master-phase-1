import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MoveScheduleModal, type MoveScheduleRow } from './MoveScheduleModal';

// Working days are the caller's business; this stand-in slides calendar days so the
// preview's arithmetic is legible in the assertions.
const shifts = [
  { id: 's1', name: 'Prep', startDate: '2026-08-31', endDate: '2026-08-31' },
  { id: 's2', name: 'Paint', startDate: '2026-09-01', endDate: '2026-09-02' },
];

const preview = (days: number, skip: string[] = []): MoveScheduleRow[] => {
  const slide = (key: string) => {
    const d = new Date(`${key}T12:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  return shifts.map(sh => {
    const from = { startDate: sh.startDate, endDate: sh.endDate };
    return {
      id: sh.id, name: sh.name, from,
      to: skip.includes(sh.id) ? from : { startDate: slide(sh.startDate), endDate: slide(sh.endDate) },
    };
  });
};

const rowFor = (name: string) => screen.getByText(name).parentElement as HTMLElement;
const tickFor = (name: string) => screen.getByRole('checkbox', { name: `Move ${name}` });

describe('MoveScheduleModal', () => {
  it('previews every shift, single day and range alike', () => {
    render(<MoveScheduleModal isOpen preview={preview} onClose={vi.fn()} onMove={vi.fn()} />);
    // Defaults to one day later.
    expect(within(rowFor('Prep')).getByText('Aug 31')).toBeInTheDocument();
    expect(within(rowFor('Prep')).getByText('Sep 1')).toBeInTheDocument();
    expect(within(rowFor('Paint')).getByText('Sep 1 – Sep 2')).toBeInTheDocument();
    expect(within(rowFor('Paint')).getByText('Sep 2 – Sep 3')).toBeInTheDocument();
  });

  it('re-previews as the day count changes', () => {
    render(<MoveScheduleModal isOpen preview={preview} onClose={vi.fn()} onMove={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('By'), { target: { value: '5' } });
    expect(within(rowFor('Prep')).getByText('Sep 5')).toBeInTheDocument();
    expect(within(rowFor('Paint')).getByText('Sep 6 – Sep 7')).toBeInTheDocument();
  });

  it('flips the whole preview with the direction switch', () => {
    render(<MoveScheduleModal isOpen preview={preview} onClose={vi.fn()} onMove={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Earlier' }));
    expect(within(rowFor('Prep')).getByText('Aug 30')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Earlier' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Later' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('moves by the signed day count and closes', () => {
    const onMove = vi.fn();
    const onClose = vi.fn();
    render(<MoveScheduleModal isOpen preview={preview} onClose={onClose} onMove={onMove} />);

    fireEvent.change(screen.getByLabelText('By'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /move 5 days later/i }));
    expect(onMove).toHaveBeenCalledWith(5, []);
    expect(onClose).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Earlier' }));
    fireEvent.click(screen.getByRole('button', { name: /move 5 days earlier/i }));
    expect(onMove).toHaveBeenLastCalledWith(-5, []);
  });

  it('clamps a nonsense day count rather than moving by it', () => {
    const onMove = vi.fn();
    render(<MoveScheduleModal isOpen preview={preview} onClose={vi.fn()} onMove={onMove} />);
    const field = screen.getByLabelText('By');

    fireEvent.change(field, { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: /move 1 days later/i }));
    expect(onMove).toHaveBeenLastCalledWith(1, []);

    fireEvent.change(field, { target: { value: '999' } });
    fireEvent.click(screen.getByRole('button', { name: /move 60 days later/i }));
    expect(onMove).toHaveBeenLastCalledWith(60, []);
  });

  it('shows a worked shift as staying put, with no new date', () => {
    const withPinned = (days: number): MoveScheduleRow[] => [
      { id: 'done', name: 'Prep', pinned: true, from: { startDate: '2026-08-24', endDate: '2026-08-24' }, to: { startDate: '2026-08-24', endDate: '2026-08-24' } },
      ...preview(days).slice(1),
    ];
    render(<MoveScheduleModal isOpen preview={withPinned} onClose={vi.fn()} onMove={vi.fn()} />);
    expect(within(rowFor('Prep')).getByText('Stays')).toBeInTheDocument();
    expect(within(rowFor('Prep')).getByText('Aug 24')).toBeInTheDocument();
    expect(screen.getByText('Days already worked stay where they are.')).toBeInTheDocument();
    // Paint still moves, so the action stays available.
    expect(screen.getByRole('button', { name: /move 1 days later/i })).not.toBeDisabled();
  });

  it('has nothing to do when every shift is worked', () => {
    const allPinned = (): MoveScheduleRow[] => [
      { id: 'done', name: 'Prep', pinned: true, from: { startDate: '2026-08-24', endDate: '2026-08-24' }, to: { startDate: '2026-08-24', endDate: '2026-08-24' } },
    ];
    render(<MoveScheduleModal isOpen preview={allPinned} onClose={vi.fn()} onMove={vi.fn()} />);
    expect(screen.getByRole('button', { name: /move 1 days later/i })).toBeDisabled();
  });

  it('says so when there is no dated shift at all', () => {
    render(<MoveScheduleModal isOpen preview={() => []} onClose={vi.fn()} onMove={vi.fn()} />);
    expect(screen.getByText('This job has no dated shift to move.')).toBeInTheDocument();
  });
});

describe('MoveScheduleModal — choosing which shifts move', () => {
  it('ticks every shift by default and moves them all', () => {
    const onMove = vi.fn();
    render(<MoveScheduleModal isOpen preview={preview} onClose={vi.fn()} onMove={onMove} />);
    expect(tickFor('Prep')).toBeChecked();
    expect(tickFor('Paint')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: /move 1 days later/i }));
    expect(onMove).toHaveBeenCalledWith(1, []);
  });

  it('drops an unticked shift out of the preview and out of the move', () => {
    const onMove = vi.fn();
    render(<MoveScheduleModal isOpen preview={preview} onClose={vi.fn()} onMove={onMove} />);

    fireEvent.click(tickFor('Prep'));
    expect(tickFor('Prep')).not.toBeChecked();
    // Prep keeps its own date, stated once, with no new one to compare.
    expect(within(rowFor('Prep')).getByText('Aug 31')).toBeInTheDocument();
    expect(within(rowFor('Prep')).queryByText('Sep 1')).toBeNull();
    // Paint still moves.
    expect(within(rowFor('Paint')).getByText('Sep 2 – Sep 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /move 1 days later/i }));
    expect(onMove).toHaveBeenCalledWith(1, ['s1']);
  });

  it('counts what is still moving, and takes a shift back', () => {
    render(<MoveScheduleModal isOpen preview={preview} onClose={vi.fn()} onMove={vi.fn()} />);
    expect(screen.getByText('2 of 2 moving')).toBeInTheDocument();
    fireEvent.click(tickFor('Paint'));
    expect(screen.getByText('1 of 2 moving')).toBeInTheDocument();
    fireEvent.click(tickFor('Paint'));
    expect(screen.getByText('2 of 2 moving')).toBeInTheDocument();
    expect(within(rowFor('Paint')).getByText('Sep 2 – Sep 3')).toBeInTheDocument();
  });

  it('refuses a move with nothing ticked, and says why', () => {
    render(<MoveScheduleModal isOpen preview={preview} onClose={vi.fn()} onMove={vi.fn()} />);
    fireEvent.click(tickFor('Prep'));
    fireEvent.click(tickFor('Paint'));
    expect(screen.getByText('Pick at least one shift to move.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /move 1 days later/i })).toBeDisabled();
  });

  it('gives a worked shift no tick to argue with', () => {
    const withPinned = (days: number, skip: string[] = []): MoveScheduleRow[] => [
      { id: 'done', name: 'Prep', pinned: true, from: { startDate: '2026-08-24', endDate: '2026-08-24' }, to: { startDate: '2026-08-24', endDate: '2026-08-24' } },
      ...preview(days, skip).slice(1),
    ];
    render(<MoveScheduleModal isOpen preview={withPinned} onClose={vi.fn()} onMove={vi.fn()} />);
    expect(screen.queryByRole('checkbox', { name: 'Move Prep' })).toBeNull();
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    // With one choosable shift there is no count to keep — the row says it all.
    expect(screen.queryByText(/moving$/)).toBeNull();
  });
});
