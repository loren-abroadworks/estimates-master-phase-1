import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EditableHoursChip } from './EditableHoursChip';
import type { MemberDayCell } from '../../../services/crewHoursGrid';

const cell = (over: Partial<MemberDayCell> = {}): MemberDayCell => ({
  jobId: 'j1', jobNumber: 'J-1', jobName: 'Miller Exterior', hours: 4.5, grossHours: 5,
  unpaidBreakHours: 0.5, breakLabel: 'Lunch', color: '#f59e0b', startTime: '08:00', endTime: '13:00',
  ...over,
});

describe('EditableHoursChip', () => {
  it('shows the net hours and a break breakdown tooltip (read-only)', () => {
    render(<EditableHoursChip cell={cell()} canEdit={false} editLabel="edit" onCommit={() => {}} onRemove={() => {}} />);
    expect(screen.getByText('4.5')).toBeTruthy();
    expect(screen.getByTitle(/5h − 0.5h Lunch \(unpaid\)/)).toBeTruthy();
  });

  it('displays net in the input until focused, then edits on gross', () => {
    render(<EditableHoursChip cell={cell()} canEdit editLabel="edit hours" onCommit={() => {}} onRemove={() => {}} />);
    const input = screen.getByLabelText('edit hours') as HTMLInputElement;
    expect(input.value).toBe('4.5');
    fireEvent.focus(input);
    expect(input.value).toBe('5'); // edits the scheduled (gross) value, not the net
  });

  it('commits the typed gross value', () => {
    const onCommit = vi.fn();
    render(<EditableHoursChip cell={cell({ unpaidBreakHours: undefined, breakLabel: undefined, hours: 5 })} canEdit editLabel="edit hours" onCommit={onCommit} onRemove={() => {}} />);
    const input = screen.getByLabelText('edit hours') as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '6' } });
    expect(onCommit).toHaveBeenCalledWith(6);
  });
  it('rings the chip when it is the highlighted job', () => {
    render(<EditableHoursChip cell={cell()} canEdit={false} highlight="on" editLabel="edit" onCommit={() => {}} onRemove={() => {}} />);
    const chip = screen.getByTitle(/J-1 · Miller Exterior/);
    expect(chip).toHaveAttribute('data-highlight', 'on');
    expect(chip.className).toMatch(/ring-2/);
    expect(chip.className).not.toMatch(/opacity-/);
  });

  it('fades the chip when another job is highlighted', () => {
    render(<EditableHoursChip cell={cell()} canEdit={false} highlight="off" editLabel="edit" onCommit={() => {}} onRemove={() => {}} />);
    const chip = screen.getByTitle(/J-1 · Miller Exterior/);
    expect(chip).toHaveAttribute('data-highlight', 'off');
    expect(chip.className).toMatch(/opacity-/);
    expect(chip.className).not.toMatch(/ring-2/);
  });

  it('carries no highlight styling when nothing is highlighted', () => {
    render(<EditableHoursChip cell={cell()} canEdit={false} editLabel="edit" onCommit={() => {}} onRemove={() => {}} />);
    const chip = screen.getByTitle(/J-1 · Miller Exterior/);
    expect(chip).not.toHaveAttribute('data-highlight');
    expect(chip.className).not.toMatch(/ring-2|opacity-/);
  });
});
