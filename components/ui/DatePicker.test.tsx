import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DatePicker } from './DatePicker';

// Sat/Sun in June 2026: 6,7,13,14,20,21,27,28.
const isWeekend = (key: string) => [0, 6].includes(new Date(`${key}T00:00:00`).getDay());

describe('DatePicker disabled days', () => {
  it('disables days for which isDateDisabled returns true and ignores their clicks', () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-06-15" onChange={onChange} isDateDisabled={isWeekend} />);
    fireEvent.click(screen.getByText('6/15/2026')); // open the calendar

    // Sat Jun 13 is a weekend → disabled, click is a no-op.
    const sat13 = screen.getByRole('button', { name: '13' });
    expect(sat13).toBeDisabled();
    fireEvent.click(sat13);
    expect(onChange).not.toHaveBeenCalled();

    // Mon Jun 15 is a working day → selectable.
    const mon15 = screen.getByRole('button', { name: '15' });
    expect(mon15).not.toBeDisabled();
    fireEvent.click(mon15);
    expect(onChange).toHaveBeenCalledWith('2026-06-15');
  });

  it('leaves all days selectable when no predicate is given', () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-06-15" onChange={onChange} />);
    fireEvent.click(screen.getByText('6/15/2026'));
    const sat13 = screen.getByRole('button', { name: '13' });
    expect(sat13).not.toBeDisabled();
    fireEvent.click(sat13);
    expect(onChange).toHaveBeenCalledWith('2026-06-13');
  });
});

describe('DatePicker month granularity', () => {
  it('opens on the month grid and commits the first of the picked month', () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-06-15" onChange={onChange} granularity="month" />);
    fireEvent.click(screen.getByText('6/15/2026')); // open the picker

    // No day grid: month cells only.
    expect(screen.queryByRole('button', { name: '15' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mar' }));
    expect(onChange).toHaveBeenCalledWith('2026-03-01');
    // Popover closed after committing.
    expect(screen.queryByRole('button', { name: 'Mar' })).toBeNull();
  });

  it('drills up to years and back to months, never down to days', () => {
    const onChange = vi.fn();
    render(<DatePicker value="2026-06-15" onChange={onChange} granularity="month" />);
    fireEvent.click(screen.getByText('6/15/2026'));

    // Header label shows the year in month mode; clicking it shows years.
    fireEvent.click(screen.getByRole('button', { name: '2026' }));
    expect(screen.getByRole('button', { name: '2027' })).toBeInTheDocument();

    // Picking a year returns to the month grid for that year.
    fireEvent.click(screen.getByRole('button', { name: '2027' }));
    expect(screen.getByRole('button', { name: 'Mar' })).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();

    // Clicking the header from months goes to years again, not days.
    fireEvent.click(screen.getByRole('button', { name: '2027' }));
    expect(screen.queryByRole('button', { name: 'Mar' })).toBeNull();
    expect(screen.getByRole('button', { name: '2027' })).toBeInTheDocument();

    // Committing from the drilled year uses that year.
    fireEvent.click(screen.getByRole('button', { name: '2027' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sep' }));
    expect(onChange).toHaveBeenCalledWith('2027-09-01');
  });
});

describe('DatePicker renderTrigger', () => {
  it('renders a custom trigger that opens the calendar; picking a day fires onChange', () => {
    const onChange = vi.fn();
    render(
      <DatePicker
        value="2026-06-15"
        onChange={onChange}
        renderTrigger={(open) => <button onClick={open}>Monday, June 15, 2026</button>}
      />,
    );
    // Default field trigger is replaced by the custom one.
    expect(screen.queryByText('6/15/2026')).toBeNull();
    fireEvent.click(screen.getByText('Monday, June 15, 2026'));
    fireEvent.click(screen.getByRole('button', { name: '18' }));
    expect(onChange).toHaveBeenCalledWith('2026-06-18');
  });
});
