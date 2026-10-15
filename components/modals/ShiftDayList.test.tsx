import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ShiftDayList } from './ShiftDayList';

// Wed 2026-08-19 → Sun 2026-08-23
const dayKeys = ['2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23'];
const noop = () => {};
const props = {
  dayKeys, skipDays: [], dayHours: {},
  defaultStart: '08:00', defaultEnd: '17:00',
  weekendDays: [0, 6],
  onDeleteDay: noop, onChangeDayWindow: noop, onSkipAll: noop,
  onChangeDefaultWindow: noop, onClearOverrides: noop, onResetDay: noop,
  onRestoreDay: noop,
};

// The DEFAULT row carries time inputs of its own, so day-row queries exclude anything
// labelled — only the default's inputs have an aria-label.
const dayInputs = (value: string) =>
  screen.getAllByDisplayValue(value).filter(i => !i.getAttribute('aria-label'));

describe('ShiftDayList', () => {
  it('renders one row per day with the default window', () => {
    render(<ShiftDayList {...props} />);
    expect(screen.getAllByRole('button', { name: 'Remove day' }).length).toBe(5);
    expect(dayInputs('08:00').length).toBe(5);
    expect(dayInputs('17:00').length).toBe(5);
  });

  it('shows a per-day override instead of the default', () => {
    render(<ShiftDayList {...props} dayHours={{ '2026-08-21': { startTime: '07:00', endTime: '12:00' } }} />);
    expect(screen.getByDisplayValue('07:00')).toBeTruthy();
    expect(screen.getByDisplayValue('12:00')).toBeTruthy();
  });

  it('keeps a removed day as a restorable row rather than dropping it', () => {
    render(<ShiftDayList {...props} skipDays={['2026-08-20']} />);
    // Four worked days keep a remove control; the removed day offers a restore instead.
    expect(screen.getAllByRole('button', { name: 'Remove day' }).length).toBe(4);
    expect(screen.getAllByRole('button', { name: 'Restore day' }).length).toBe(1);
    expect(screen.getByText('Thu, Aug 20')).toBeTruthy();
    expect(screen.getByText('Wed, Aug 19')).toBeTruthy();
  });

  it('reports the day to remove', () => {
    const onDeleteDay = vi.fn();
    render(<ShiftDayList {...props} onDeleteDay={onDeleteDay} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove day' })[1]);
    expect(onDeleteDay).toHaveBeenCalledWith('2026-08-20');
  });

  // Deleting the last day would leave a shift that works nothing, recoverable only by
  // widening the dates — a trap, so the control is disabled instead.
  it('refuses to remove the only remaining day', () => {
    const onDeleteDay = vi.fn();
    render(<ShiftDayList {...props} dayKeys={['2026-08-19']} onDeleteDay={onDeleteDay} />);
    const btn = screen.getByRole('button', { name: 'Remove day' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onDeleteDay).not.toHaveBeenCalled();
  });

  it('reports a per-day start time change', () => {
    const onChangeDayWindow = vi.fn();
    render(<ShiftDayList {...props} onChangeDayWindow={onChangeDayWindow} />);
    fireEvent.change(dayInputs('08:00')[0], { target: { value: '07:00' } });
    expect(onChangeDayWindow).toHaveBeenCalledWith('2026-08-19', { startTime: '07:00', endTime: '17:00' });
  });

  it('Skip weekends skips exactly the weekend days in range', () => {
    const onSkipAll = vi.fn();
    render(<ShiftDayList {...props} onSkipAll={onSkipAll} />);
    fireEvent.click(screen.getByText('Skip weekends'));
    expect(onSkipAll).toHaveBeenCalledWith(['2026-08-22', '2026-08-23']);
  });

  it('shows each worked day its hours', () => {
    render(<ShiftDayList {...props} dayHours={{ '2026-08-21': { startTime: '07:00', endTime: '12:00' } }} />);
    expect(screen.getAllByText('9.0h').length).toBe(4);
    expect(screen.getByText('5.0h')).toBeTruthy();
  });
});

describe('ShiftDayList default window', () => {
  const override = { '2026-08-21': { startTime: '07:00', endTime: '12:00' } };

  it('offers a default start and end above the day rows', () => {
    render(<ShiftDayList {...props} />);
    const start = screen.getByLabelText('Default start');
    const end = screen.getByLabelText('Default end');
    expect((start as HTMLInputElement).value).toBe('08:00');
    expect((end as HTMLInputElement).value).toBe('17:00');
  });

  it('reports a default start change without touching any day', () => {
    const onChangeDefaultWindow = vi.fn();
    const onChangeDayWindow = vi.fn();
    render(<ShiftDayList {...props} onChangeDefaultWindow={onChangeDefaultWindow} onChangeDayWindow={onChangeDayWindow} />);
    fireEvent.change(screen.getByLabelText('Default start'), { target: { value: '09:00' } });
    expect(onChangeDefaultWindow).toHaveBeenCalledWith({ startTime: '09:00', endTime: '17:00' });
    // The default is not a bulk edit of the rows — untouched days follow it by fallback.
    expect(onChangeDayWindow).not.toHaveBeenCalled();
  });

  it('marks only a day that genuinely differs from the default', () => {
    render(<ShiftDayList {...props} dayHours={override} />);
    expect(screen.getAllByText('Custom').length).toBe(1);
  });

  it('does not mark a day whose override happens to equal the default', () => {
    render(<ShiftDayList {...props} dayHours={{ '2026-08-21': { startTime: '08:00', endTime: '17:00' } }} />);
    expect(screen.queryByText('Custom')).toBeNull();
  });

  it('resets a single day back to the default', () => {
    const onResetDay = vi.fn();
    render(<ShiftDayList {...props} dayHours={override} onResetDay={onResetDay} />);
    fireEvent.click(screen.getByRole('button', { name: 'Reset to default' }));
    expect(onResetDay).toHaveBeenCalledWith('2026-08-21');
  });

  it('Apply to all clears every per-day override', () => {
    const onClearOverrides = vi.fn();
    render(<ShiftDayList {...props} dayHours={override} onClearOverrides={onClearOverrides} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply to all days' }));
    expect(onClearOverrides).toHaveBeenCalledOnce();
  });

  it('offers no Apply to all when nothing is overridden', () => {
    render(<ShiftDayList {...props} />);
    expect(screen.queryByRole('button', { name: 'Apply to all days' })).toBeNull();
  });
});

describe('ShiftDayList removed days', () => {
  it('offers no time inputs on a removed day — there is nothing to edit', () => {
    render(<ShiftDayList {...props} skipDays={['2026-08-20']} />);
    // Four worked rows keep their inputs; the removed day has none.
    expect(dayInputs('08:00').length).toBe(4);
    expect(screen.getByText('Removed')).toBeTruthy();
  });

  it('reports the day to restore', () => {
    const onRestoreDay = vi.fn();
    render(<ShiftDayList {...props} skipDays={['2026-08-20']} onRestoreDay={onRestoreDay} />);
    fireEvent.click(screen.getByRole('button', { name: 'Restore day' }));
    expect(onRestoreDay).toHaveBeenCalledWith('2026-08-20');
  });

  it('does not count a removed day toward the last-day guard', () => {
    // Four of five removed: the single worked day cannot be removed, but the removed
    // ones stay restorable, so this is never a dead end.
    render(<ShiftDayList {...props} skipDays={['2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23']} />);
    expect((screen.getByRole('button', { name: 'Remove day' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Restore day' }).length).toBe(4);
  });

  it('excludes a removed day from the Custom marker', () => {
    render(<ShiftDayList {...props}
      skipDays={['2026-08-21']}
      dayHours={{ '2026-08-21': { startTime: '07:00', endTime: '12:00' } }} />);
    expect(screen.queryByText('Custom')).toBeNull();
  });
});
