import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AssignHoursModal, type AssignHoursDay } from './AssignHoursModal';

const jobs = [
  { id: 'j1', jobNumber: 'J-1', name: 'Smith St' },
  { id: 'j2', jobNumber: 'J-2', name: 'Oak Ave' },
];

const daysByJob: Record<string, AssignHoursDay[]> = {
  j1: [{ dateKey: '2026-06-03', weekday: 'Wed', dayNum: '3', hours: 8 }],
  j2: [
    { dateKey: '2026-06-04', weekday: 'Thu', dayNum: '4', hours: 9, startTime: '08:00', endTime: '17:00' },
    { dateKey: '2026-06-05', weekday: 'Fri', dayNum: '5', hours: 9, startTime: '08:00', endTime: '17:00' },
  ],
};
const getDays = (jobId: string) => daysByJob[jobId] ?? [];

describe('AssignHoursModal', () => {
  it('submits the selected job with per-day hours', () => {
    const onSubmit = vi.fn();
    render(<AssignHoursModal isOpen memberName="Mike" jobs={jobs} getDays={getDays} onClose={vi.fn()} onSubmit={onSubmit} />);

    // Switch to j2 (two days), then shorten Friday to 4h by retiming it.
    fireEvent.change(screen.getByLabelText(/job/i), { target: { value: 'j2' } });
    fireEvent.change(screen.getByLabelText(/end time on fri 5/i), { target: { value: '12:00' } });
    fireEvent.click(screen.getByRole('button', { name: /assign/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      'j2',
      { '2026-06-04': 9, '2026-06-05': 4 },
      { '2026-06-05': { startTime: '08:00', endTime: '12:00' } },
    );
  });

  it('prefills the locked job, and a removed day submits as zero', () => {
    const onSubmit = vi.fn();
    render(<AssignHoursModal isOpen memberName="Mike" jobs={jobs} lockedJobId="j2" getDays={getDays} onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: /remove thu 4/i }));
    // The row goes with it, and only Friday is left to count.
    expect(screen.queryByLabelText(/hours on thu 4/i)).toBeNull();
    expect(screen.getByText('9h total')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /assign/i }));
    expect(onSubmit).toHaveBeenCalledWith('j2', { '2026-06-04': 0, '2026-06-05': 9 }, {});
  });

  it('keeps a retimed window off a day that is then removed', () => {
    const onSubmit = vi.fn();
    render(<AssignHoursModal isOpen memberName="Mike" jobs={jobs} lockedJobId="j2" getDays={getDays} onClose={vi.fn()} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText(/end time on thu 4/i), { target: { value: '13:00' } });
    fireEvent.click(screen.getByRole('button', { name: /remove thu 4/i }));
    fireEvent.click(screen.getByRole('button', { name: /assign/i }));

    expect(onSubmit).toHaveBeenCalledWith('j2', { '2026-06-04': 0, '2026-06-05': 9 }, {});
  });

  it('shows each day\'s start and end time as editable fields', () => {
    render(<AssignHoursModal isOpen memberName="Mike" jobs={jobs} lockedJobId="j2" getDays={getDays} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/start time on thu 4/i)).toHaveValue('08:00');
    expect(screen.getByLabelText(/end time on thu 4/i)).toHaveValue('17:00');
    expect(screen.getByLabelText(/start time on fri 5/i)).toHaveValue('08:00');
  });

  it('re-derives a day\'s hours when its times change, and submits the edited window', () => {
    const onSubmit = vi.fn();
    render(<AssignHoursModal isOpen memberName="Mike" jobs={jobs} lockedJobId="j2" getDays={getDays} onClose={vi.fn()} onSubmit={onSubmit} />);

    // 8:00 → 13:00 on Thursday: 5 hours.
    fireEvent.change(screen.getByLabelText(/end time on thu 4/i), { target: { value: '13:00' } });
    expect(screen.getByLabelText(/hours on thu 4/i)).toHaveTextContent('5');

    fireEvent.click(screen.getByRole('button', { name: /assign/i }));
    expect(onSubmit).toHaveBeenCalledWith(
      'j2',
      { '2026-06-04': 5, '2026-06-05': 9 },
      { '2026-06-04': { startTime: '08:00', endTime: '13:00' } },
    );
  });

  it('shows each day\'s hours as a computed figure, with no field to type into', () => {
    render(<AssignHoursModal isOpen memberName="Mike" jobs={jobs} lockedJobId="j2" getDays={getDays} onClose={vi.fn()} onSubmit={vi.fn()} />);
    const hours = screen.getByLabelText(/hours on thu 4/i);
    expect(hours.tagName).toBe('OUTPUT');
    expect(hours).toHaveTextContent('9');
    // The only number inputs left are none: the times and the figure are all there is.
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0);
  });

  it('renders live over-limit warnings from getWarnings and updates as hours change', () => {
    // Warn only when the entered total exceeds 10h, echoing the live value back.
    const getWarnings = (_jobId: string, hoursByDay: Record<string, number>) => {
      const total = Object.values(hoursByDay).reduce((s, h) => s + h, 0);
      return total > 10 ? [`Over the limit — ${total}h entered.`] : [];
    };
    render(<AssignHoursModal isOpen memberName="Mike" jobs={jobs} lockedJobId="j2" getDays={getDays} getWarnings={getWarnings} onClose={vi.fn()} onSubmit={vi.fn()} />);

    // Prefill is 9 + 9 = 18h => over the limit, warning visible.
    expect(screen.getByText(/over the limit — 18h entered/i)).toBeInTheDocument();

    // Shorten both days to 4h; the warning disappears.
    fireEvent.change(screen.getByLabelText(/end time on thu 4/i), { target: { value: '12:00' } });
    fireEvent.change(screen.getByLabelText(/end time on fri 5/i), { target: { value: '12:00' } });
    expect(screen.queryByText(/over the limit/i)).not.toBeInTheDocument();
  });

  it('opens the per-day break editor from a day row when onEditBreaks is provided', () => {
    const onEditBreaks = vi.fn();
    const withBreaks: Record<string, AssignHoursDay[]> = {
      j2: [
        { dateKey: '2026-06-04', weekday: 'Thu', dayNum: '4', hours: 9, breaks: [{ id: 'b1', label: 'Lunch', durationMinutes: 30, paid: false, startTime: '12:00' }] },
        { dateKey: '2026-06-05', weekday: 'Fri', dayNum: '5', hours: 9 },
      ],
    };
    render(<AssignHoursModal isOpen memberName="Mike" jobs={jobs} lockedJobId="j2" getDays={(id) => withBreaks[id] ?? []} onEditBreaks={onEditBreaks} onClose={vi.fn()} onSubmit={vi.fn()} />);

    // Thursday has a break -> "Edit breaks"; clicking opens the editor for that day.
    fireEvent.click(screen.getByRole('button', { name: /edit breaks on thu 4/i }));
    expect(onEditBreaks).toHaveBeenCalledWith('2026-06-04');

    // Friday has none -> "Add break".
    fireEvent.click(screen.getByRole('button', { name: /add break on fri 5/i }));
    expect(onEditBreaks).toHaveBeenCalledWith('2026-06-05');
  });

  it('omits break controls when onEditBreaks is not provided', () => {
    render(<AssignHoursModal isOpen memberName="Mike" jobs={jobs} lockedJobId="j2" getDays={getDays} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /break/i })).not.toBeInTheDocument();
  });

  it('shows live hours-still-needed from getProgress and updates as hours change', () => {
    // Estimate 40h; job has 10h already on other days; entry counts toward it.
    const getProgress = (_jobId: string, hoursByDay: Record<string, number>) => {
      const entered = Object.values(hoursByDay).reduce((s, h) => s + h, 0);
      const assigned = 10 + entered;
      return { assigned, estimate: 40, remaining: Math.max(0, 40 - assigned) };
    };
    render(<AssignHoursModal isOpen memberName="Mike" jobs={jobs} lockedJobId="j2" getDays={getDays} getProgress={getProgress} onClose={vi.fn()} onSubmit={vi.fn()} />);

    // Prefill 9 + 9 = 18 entered => 28 assigned => 12 still needed.
    expect(screen.getByText(/12h still needed/i)).toBeInTheDocument();

    // Stretch Thursday to 8:00–23:00 (15h) => 24 entered => 34 assigned => 6 still needed.
    fireEvent.change(screen.getByLabelText(/end time on thu 4/i), { target: { value: '23:00' } });
    expect(screen.getByText(/6h still needed/i)).toBeInTheDocument();

    // Remove Friday instead => 15 entered => 25 assigned => 15 still needed.
    fireEvent.click(screen.getByRole('button', { name: /remove fri 5/i }));
    expect(screen.getByText(/15h still needed/i)).toBeInTheDocument();
  });
});

describe('AssignHoursModal — with no day to assign, it says why', () => {
  const empty = () => [] as AssignHoursDay[];
  const props = {
    isOpen: true as const, memberName: 'Mike Smith', jobs, lockedJobId: 'j1',
    getDays: empty, onClose: vi.fn(), onSubmit: vi.fn(),
  };

  it('says the job is not scheduled yet', () => {
    render(<AssignHoursModal {...props} getNoDaysReason={() => ({ kind: 'unscheduled' })} />);
    expect(screen.getByText(/J-1 has no dates yet/i)).toBeInTheDocument();
  });

  it('says when the job actually runs, if not this week', () => {
    render(<AssignHoursModal {...props} getNoDaysReason={() => ({ kind: 'notThisWeek', dayLabels: ['Mon 22', 'Tue 23'] })} />);
    expect(screen.getByText(/does not run this week/i)).toBeInTheDocument();
    expect(screen.getByText(/Mon 22, Tue 23/)).toBeInTheDocument();
  });

  it('drops the per-day helper line, which has nothing to describe', () => {
    render(<AssignHoursModal {...props} getNoDaysReason={() => ({ kind: 'unscheduled' })} />);
    expect(screen.queryByText(/Remove a day to drop it/i)).toBeNull();
  });

  it('keeps Assign disabled, since there is nothing to assign', () => {
    render(<AssignHoursModal {...props} getNoDaysReason={() => ({ kind: 'unscheduled' })} />);
    expect(screen.getByRole('button', { name: 'Assign' })).toBeDisabled();
  });
});

describe('AssignHoursModal — a day the member is off', () => {
  const offDays: AssignHoursDay[] = [
    { dateKey: '2026-08-17', weekday: 'Mon', dayNum: '17', hours: 0, startTime: '08:00', endTime: '17:00', off: true, offReason: 'Vacation' },
    { dateKey: '2026-08-18', weekday: 'Tue', dayNum: '18', hours: 4, startTime: '08:00', endTime: '17:00' },
  ];
  const props = {
    isOpen: true as const, memberName: 'Mike Smith', jobs, lockedJobId: 'j1',
    getDays: () => offDays, onClose: vi.fn(), onSubmit: vi.fn(),
  };

  it('marks the day off with the reason they gave', () => {
    render(<AssignHoursModal {...props} />);
    expect(screen.getByText('Vacation')).toBeInTheDocument();
  });

  it('still lets hours land on it and be assigned', () => {
    const onSubmit = vi.fn();
    render(<AssignHoursModal {...props} onSubmit={onSubmit} />);
    // A day off is offered like any other: retiming it to 8:00–14:00 books 6h.
    fireEvent.change(screen.getByLabelText(/end time on Mon 17/i), { target: { value: '14:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Assign' }));
    expect(onSubmit).toHaveBeenCalledWith(
      'j1',
      { '2026-08-17': 6, '2026-08-18': 4 },
      { '2026-08-17': { startTime: '08:00', endTime: '14:00' } },
    );
  });

  it('warns once hours land on the day off, naming it', () => {
    render(<AssignHoursModal {...props} />);
    expect(screen.queryByText(/is off on/i)).toBeNull(); // nothing on it yet
    fireEvent.change(screen.getByLabelText(/end time on Mon 17/i), { target: { value: '14:00' } });
    expect(screen.getByText('Mike Smith is off on Mon 17. Those 6h fall on a day off.')).toBeInTheDocument();
  });

  it('drops the warning again when the day is removed', () => {
    render(<AssignHoursModal {...props} />);
    fireEvent.change(screen.getByLabelText(/end time on Mon 17/i), { target: { value: '14:00' } });
    expect(screen.getByText(/is off on/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /remove Mon 17/i }));
    expect(screen.queryByText(/is off on/i)).toBeNull();
  });
});
