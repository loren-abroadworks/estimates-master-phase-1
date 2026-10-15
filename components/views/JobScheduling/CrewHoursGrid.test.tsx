import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrewHoursGrid } from './CrewHoursGrid';
import type { CrewHoursGridModel } from '../../../services/crewHoursGrid';

const model: CrewHoursGridModel = {
  dayKeys: ['2026-06-08', '2026-06-09'],
  rows: [{
    memberId: 'm1', name: 'Mike', role: 'Painter',
    cellsByDay: { '2026-06-08': [{ jobId: 'staffed', jobNumber: 'J-1', jobName: 'Staffed', hours: 8, color: '#06b6d4', startTime: '08:00', endTime: '17:00' }], '2026-06-09': [] },
    offByDay: { '2026-06-08': false, '2026-06-09': false },
    breaksByDay: { '2026-06-08': [{ id: 'b1', label: 'Lunch', durationMinutes: 30, paid: false, startTime: '12:00' }], '2026-06-09': [] },
    availByDay: { '2026-06-08': { off: false, startTime: '08:00', endTime: '17:00' }, '2026-06-09': { off: false, startTime: '08:00', endTime: '17:00' } },
    weekTotal: 8, capacity: 40, remaining: 32, overCapacity: false, paidHours: 8,
    availableHoursByDay: { '2026-06-08': 8, '2026-06-09': 8 },
  }],
  jobs: [
    { jobId: 'staffed', jobNumber: 'J-1', jobName: 'Staffed', address: '1 St', color: '#06b6d4', estimate: 8, required: 8, assigned: 8, missing: 0, days: ['2026-06-08'], shifts: [{ shiftId: 'sa', name: 'Crew', startTime: '08:00', endTime: '17:00', days: ['2026-06-08'] }] },
    { jobId: 'unstaffed', jobNumber: 'J-2', jobName: 'Unstaffed', address: '2 St', color: '#f97316', estimate: 20, required: 20, assigned: 0, missing: 20, days: ['2026-06-08', '2026-06-09'], shifts: [{ shiftId: 'sb', name: 'Crew', startTime: '08:00', endTime: '17:00', days: ['2026-06-08', '2026-06-09'] }] },
  ],
  dayTotals: { '2026-06-08': { assigned: 8, capacity: 40 }, '2026-06-09': { assigned: 0, capacity: 40 } },
};

describe('CrewHoursGrid', () => {
  it('renders a member row, a day cell job, and the jobs panel with a missing-hours flag', () => {
    render(<CrewHoursGrid model={model} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    expect(screen.getByText('Mike')).toBeInTheDocument();
    // Day-cell editor for the staffed job (unique aria-label distinguishes it from the jobs panel).
    expect(screen.getByLabelText(/J-1 hours for Mike on 2026-06-08/i)).toHaveValue(8);
    expect(screen.getByText(/Unstaffed/)).toBeInTheDocument();
    expect(screen.getByText(/20h missing/i)).toBeInTheDocument();
  });

  it('shows the per-day assigned / capacity total in the header', () => {
    render(<CrewHoursGrid model={model} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    const totals = screen.getAllByTitle(/total crew capacity/i);
    expect(totals[0]).toHaveTextContent('8 / 40h'); // Mon
    expect(totals[1]).toHaveTextContent('0 / 40h'); // Tue
  });

  it('shows a weather forecast icon in the day header when a forecast is provided', () => {
    render(<CrewHoursGrid model={model} canEdit weather={{ '2026-06-08': 'rain' }} onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    expect(screen.getByRole('img', { name: /weather: rain/i })).toBeInTheDocument();
  });

  it('shows the per-day start and end time on a day cell card', () => {
    render(<CrewHoursGrid model={model} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    expect(screen.getByText(/8:00 AM\s*–\s*5:00 PM/)).toBeInTheDocument();
  });

  it('passes the job id AND the dragged shift id when a job card is dropped on a member', () => {
    const onDropJobOnMember = vi.fn();
    render(<CrewHoursGrid model={model} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={onDropJobOnMember} />);

    const data: Record<string, string> = {};
    const dt = { setData: (t: string, v: string) => { data[t] = v; }, getData: (t: string) => data[t] ?? '', effectAllowed: '' } as unknown as DataTransfer;
    // Drag the "Unstaffed" job card (single shift 'sb') from the sidebar onto Mike's row.
    const card = screen.getByText('Unstaffed').closest('[draggable="true"]')!;
    fireEvent.dragStart(card, { dataTransfer: dt });
    const mikeRow = screen.getByText('Mike').closest('tr')!;
    fireEvent.drop(mikeRow, { dataTransfer: dt });

    expect(onDropJobOnMember).toHaveBeenCalledWith('m1', 'unstaffed', 'sb');
  });

  it('opens the details sidebar when a member day-cell job chip is clicked', () => {
    const onSelectJob = vi.fn();
    render(<CrewHoursGrid model={model} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} onSelectJob={onSelectJob} />);
    // The chip in Mike's Mon cell shows the job name; clicking it opens details.
    fireEvent.click(screen.getByRole('button', { name: /view staffed details/i }));
    expect(onSelectJob).toHaveBeenCalledWith('staffed');
  });

  it('fires onAssignWeek with the member id when the row assign button is clicked', () => {
    const onAssignWeek = vi.fn();
    render(<CrewHoursGrid model={model} canEdit onAssignWeek={onAssignWeek} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /assign hours to mike/i }));
    expect(onAssignWeek).toHaveBeenCalledWith('m1');
  });

  it('keeps the day card visible while the hours field is cleared, removing it only on blur', () => {
    const onRemoveDay = vi.fn();
    render(<CrewHoursGrid model={model} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={onRemoveDay} onDropJobOnMember={vi.fn()} />);
    const input = screen.getByLabelText(/J-1 hours for Mike on 2026-06-08/i);

    // Clearing the field must NOT remove the card mid-edit — it stays put, empty.
    fireEvent.change(input, { target: { value: '' } });
    expect(onRemoveDay).not.toHaveBeenCalled();
    expect(input).toHaveValue(null);

    // Removal happens only when focus leaves the still-empty field.
    fireEvent.blur(input);
    expect(onRemoveDay).toHaveBeenCalledWith('m1', '2026-06-08', 'staffed', undefined);
  });

  it('renders a break chip for a member-day with breaks', () => {
    render(<CrewHoursGrid model={model} canEdit={false} onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    expect(screen.getByTitle(/Lunch · 30m/)).toBeInTheDocument();
  });

  it('renders break chips read-only (no break editor wiring on the grid)', () => {
    render(<CrewHoursGrid model={model} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    // The break chip shows but is not a button (editing now lives in the Assign Hours modal).
    const chip = screen.getByTitle(/Lunch · 30m/);
    expect(chip.tagName).not.toBe('BUTTON');
    // No "+ break" affordance on the grid anymore.
    expect(screen.queryByRole('button', { name: '+ break' })).not.toBeInTheDocument();
  });

  it('shows the jobs sidebar by default and hides it when hideSidebar is set', () => {
    const { rerender } = render(<CrewHoursGrid model={model} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    expect(screen.getByText('Jobs This Week')).toBeInTheDocument();
    rerender(<CrewHoursGrid model={model} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} hideSidebar />);
    expect(screen.queryByText('Jobs This Week')).not.toBeInTheDocument();
    // The grid itself stays rendered, now full-width.
    expect(screen.getByText('Mike')).toBeInTheDocument();
  });

  it('hides break chips when showAvailability is false, keeping job chips', () => {
    render(<CrewHoursGrid model={model} canEdit showAvailability={false} onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    expect(screen.queryByTitle(/Lunch · 30m/)).not.toBeInTheDocument();
    // The job day-cell chip still renders.
    expect(screen.getByLabelText(/J-1 hours for Mike on 2026-06-08/i)).toHaveValue(8);
  });

  it('hides the "Off" cell label when showAvailability is false', () => {
    const offModel: CrewHoursGridModel = {
      ...model,
      // offByDay and availByDay both come from the one schedule entry upstream, so a
      // fixture must not let them disagree.
      rows: [{
        ...model.rows[0],
        offByDay: { '2026-06-08': false, '2026-06-09': true },
        availByDay: {
          '2026-06-08': { off: false, startTime: '08:00', endTime: '17:00' },
          '2026-06-09': { off: true, startTime: '08:00', endTime: '17:00' },
        },
      }],
    };
    const { rerender } = render(<CrewHoursGrid model={offModel} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    expect(screen.getByText('Off')).toBeInTheDocument();
    rerender(<CrewHoursGrid model={offModel} canEdit showAvailability={false} onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    expect(screen.queryByText('Off')).not.toBeInTheDocument();
  });

  it('shows the per-day hours window on a working cell, hidden when showAvailability is false', () => {
    const { rerender } = render(<CrewHoursGrid model={model} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    expect(screen.getAllByText('8am–5pm').length).toBeGreaterThan(0);
    rerender(<CrewHoursGrid model={model} canEdit showAvailability={false} onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    expect(screen.queryByText('8am–5pm')).not.toBeInTheDocument();
  });

  it('commits a valid hours edit live without removing the card', () => {
    const onEditDay = vi.fn();
    const onRemoveDay = vi.fn();
    render(<CrewHoursGrid model={model} canEdit onAssignWeek={vi.fn()} onEditDay={onEditDay} onRemoveDay={onRemoveDay} onDropJobOnMember={vi.fn()} />);
    const input = screen.getByLabelText(/J-1 hours for Mike on 2026-06-08/i);
    fireEvent.change(input, { target: { value: '6' } });
    expect(onEditDay).toHaveBeenCalledWith('m1', '2026-06-08', 'staffed', 6, undefined);
    expect(onRemoveDay).not.toHaveBeenCalled();
  });

  it('passes the chip shiftId to onEditDay for a shift-scoped cell', () => {
    const onEditDay = vi.fn();
    const shiftModel: CrewHoursGridModel = {
      ...model,
      rows: [{
        ...model.rows[0],
        cellsByDay: {
          '2026-06-08': [{ jobId: 'j1', jobNumber: 'J-1', jobName: 'Ext', hours: 4, color: '#333', shiftId: 'finish', shiftName: 'Finish', startTime: '13:00', endTime: '17:00' }],
          '2026-06-09': [],
        },
      }],
    };
    render(<CrewHoursGrid model={shiftModel} canEdit onAssignWeek={vi.fn()} onEditDay={onEditDay} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    const input = screen.getByLabelText(/J-1 hours for Mike on 2026-06-08/i);
    fireEvent.change(input, { target: { value: '5' } });
    expect(onEditDay).toHaveBeenCalledWith('m1', '2026-06-08', 'j1', 5, 'finish');
  });
});

describe('CrewHoursGrid — dragging a day chip to another member', () => {
  // Two members, both working Mon and Tue. Mike holds the chip; Ana is the target.
  const day = { off: false, startTime: '08:00', endTime: '17:00' };
  const chip = { jobId: 'staffed', jobNumber: 'J-1', jobName: 'Staffed', hours: 8, grossHours: 8.5, color: '#06b6d4', shiftId: 'sa', startTime: '08:00', endTime: '17:00' };
  const twoMemberModel: CrewHoursGridModel = {
    ...model,
    rows: [
      { ...model.rows[0], cellsByDay: { '2026-06-08': [chip], '2026-06-09': [] } },
      {
        memberId: 'm2', name: 'Ana', role: 'Painter',
        cellsByDay: { '2026-06-08': [], '2026-06-09': [] },
        offByDay: { '2026-06-08': false, '2026-06-09': false },
        breaksByDay: { '2026-06-08': [], '2026-06-09': [] },
        availByDay: { '2026-06-08': day, '2026-06-09': day },
        weekTotal: 0, capacity: 40, remaining: 40, overCapacity: false, paidHours: 0,
        availableHoursByDay: { '2026-06-08': 8, '2026-06-09': 8 },
      },
    ],
  };

  const fakeDataTransfer = () => {
    const data: Record<string, string> = {};
    return {
      setData: (t: string, v: string) => { data[t] = v; },
      getData: (t: string) => data[t] ?? '',
      get types() { return Object.keys(data); },
      effectAllowed: '', dropEffect: '',
    } as unknown as DataTransfer;
  };

  // The cell (td) for a member on a day key, addressed by its test id.
  const cellFor = (memberId: string, dateKey: string) => screen.getByTestId(`crew-cell-${memberId}-${dateKey}`);

  const dragChip = (dt: DataTransfer) => {
    const el = screen.getByRole('button', { name: /view staffed details/i }).closest('[draggable="true"]')!;
    fireEvent.dragStart(el, { dataTransfer: dt });
  };

  const renderGrid = (onTransferHours: ReturnType<typeof vi.fn>, m = twoMemberModel) =>
    render(<CrewHoursGrid model={m} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()}
      onDropJobOnMember={vi.fn()} onTransferHours={onTransferHours} />);

  it('transfers the chip\'s gross hours to the member dropped on, on the same day', () => {
    const onTransferHours = vi.fn();
    renderGrid(onTransferHours);
    const dt = fakeDataTransfer();
    dragChip(dt);
    fireEvent.drop(cellFor('m2', '2026-06-08'), { dataTransfer: dt });

    expect(onTransferHours).toHaveBeenCalledWith(
      { memberId: 'm1', dateKey: '2026-06-08', jobId: 'staffed', shiftId: 'sa', hours: 8.5 },
      'm2',
    );
  });

  it('ignores a drop on another day, so the transfer never moves the date', () => {
    const onTransferHours = vi.fn();
    renderGrid(onTransferHours);
    const dt = fakeDataTransfer();
    dragChip(dt);
    fireEvent.drop(cellFor('m2', '2026-06-09'), { dataTransfer: dt });
    expect(onTransferHours).not.toHaveBeenCalled();
  });

  it('ignores a drop back on the chip\'s own member', () => {
    const onTransferHours = vi.fn();
    renderGrid(onTransferHours);
    const dt = fakeDataTransfer();
    dragChip(dt);
    fireEvent.drop(cellFor('m1', '2026-06-08'), { dataTransfer: dt });
    expect(onTransferHours).not.toHaveBeenCalled();
  });

  it('accepts a drop on a member who is off that day, since the chip lands flagged', () => {
    // Blocking it left no way to book someone onto a day off; the amber flag on the
    // landed chip is the warning instead.
    const onTransferHours = vi.fn();
    const offModel: CrewHoursGridModel = {
      ...twoMemberModel,
      rows: [
        twoMemberModel.rows[0],
        {
          ...twoMemberModel.rows[1],
          offByDay: { '2026-06-08': true, '2026-06-09': false },
          availByDay: {
            '2026-06-08': { off: true, startTime: '08:00', endTime: '17:00' },
            '2026-06-09': { off: false, startTime: '08:00', endTime: '17:00' },
          },
        },
      ],
    };
    renderGrid(onTransferHours, offModel);
    const dt = fakeDataTransfer();
    dragChip(dt);
    fireEvent.drop(cellFor('m2', '2026-06-08'), { dataTransfer: dt });
    expect(onTransferHours).toHaveBeenCalledWith(
      { memberId: 'm1', dateKey: '2026-06-08', jobId: 'staffed', shiftId: 'sa', hours: 8.5 },
      'm2',
    );
  });

  it('does not fire the job-assign drop handler when a chip is dropped', () => {
    const onDropJobOnMember = vi.fn();
    render(<CrewHoursGrid model={twoMemberModel} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()}
      onDropJobOnMember={onDropJobOnMember} onTransferHours={vi.fn()} />);
    const dt = fakeDataTransfer();
    dragChip(dt);
    fireEvent.drop(cellFor('m2', '2026-06-08'), { dataTransfer: dt });
    expect(onDropJobOnMember).not.toHaveBeenCalled();
  });

  it('leaves chips undraggable when the grid is read-only', () => {
    render(<CrewHoursGrid model={twoMemberModel} canEdit={false} onAssignWeek={vi.fn()} onEditDay={vi.fn()}
      onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} onTransferHours={vi.fn()} />);
    const chipEl = screen.getByRole('button', { name: /view staffed details/i }).closest('div[title]')!;
    expect(chipEl).not.toHaveAttribute('draggable', 'true');
  });
});

describe('CrewHoursGrid — availability conflicts are shown, not hidden', () => {
  const offRow = (): CrewHoursGridModel => ({
    ...model,
    rows: [{
      ...model.rows[0],
      offByDay: { '2026-06-08': true, '2026-06-09': false },
      cellsByDay: {
        '2026-06-08': [{ jobId: 'staffed', jobNumber: 'J-1', jobName: 'Staffed', hours: 8, color: '#06b6d4',
          startTime: '08:00', endTime: '17:00', onOffDay: true }],
        '2026-06-09': [],
      },
      availByDay: {
        '2026-06-08': { off: true, startTime: '08:00', endTime: '17:00' },
        '2026-06-09': { off: false, startTime: '08:00', endTime: '17:00' },
      },
      availableHoursByDay: { '2026-06-08': 0, '2026-06-09': 8 },
    }],
  });

  it('keeps an off day\'s booked chip on screen, alongside an Off badge', () => {
    render(<CrewHoursGrid model={offRow()} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()}
      onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    // The booking is still editable — the scheduler can see and fix it.
    expect(screen.getByLabelText(/J-1 hours for Mike on 2026-06-08/i)).toHaveValue(8);
    expect(screen.getByText(/^Off$/)).toBeInTheDocument();
  });

  it('says why a chip is flagged when it falls outside the member\'s hours', () => {
    const outside: CrewHoursGridModel = {
      ...model,
      rows: [{
        ...model.rows[0],
        availableHoursByDay: { '2026-06-08': 4, '2026-06-09': 8 },
        cellsByDay: {
          '2026-06-08': [{ jobId: 'staffed', jobNumber: 'J-1', jobName: 'Staffed', hours: 4, color: '#06b6d4',
            startTime: '13:00', endTime: '17:00', outsideAvailability: { before: 0, after: 5 } }],
          '2026-06-09': [],
        },
        availByDay: {
          '2026-06-08': { off: false, startTime: '08:00', endTime: '12:00' },
          '2026-06-09': { off: false, startTime: '08:00', endTime: '17:00' },
        },
      }],
    };
    render(<CrewHoursGrid model={outside} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()}
      onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    expect(screen.getByLabelText(/J-1 hours for Mike on 2026-06-08/i).getAttribute('title'))
      .toContain('Outside 8am–12pm');
  });

  it('names the member on a chip booked on their off day', () => {
    render(<CrewHoursGrid model={offRow()} canEdit onAssignWeek={vi.fn()} onEditDay={vi.fn()}
      onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    expect(screen.getByLabelText(/J-1 hours for Mike on 2026-06-08/i).getAttribute('title'))
      .toContain('Mike is off this day');
  });
});

describe('CrewHoursGrid — the selected job is highlighted across the grid', () => {
  // Mike works the selected job (Mon) and another one (Tue); Ana works only the other
  // one, so she must NOT be highlighted.
  const day = { off: false, startTime: '08:00', endTime: '17:00' };
  const staffedChip = { jobId: 'staffed', jobNumber: 'J-1', jobName: 'Staffed', hours: 8, color: '#06b6d4', startTime: '08:00', endTime: '17:00' };
  const otherChip = { jobId: 'other', jobNumber: 'J-3', jobName: 'Other', hours: 4, color: '#f97316', startTime: '08:00', endTime: '12:00' };
  const twoJobModel: CrewHoursGridModel = {
    ...model,
    rows: [
      { ...model.rows[0], cellsByDay: { '2026-06-08': [staffedChip], '2026-06-09': [otherChip] } },
      {
        memberId: 'm2', name: 'Ana', role: 'Painter',
        cellsByDay: { '2026-06-08': [otherChip], '2026-06-09': [] },
        offByDay: { '2026-06-08': false, '2026-06-09': false },
        breaksByDay: { '2026-06-08': [], '2026-06-09': [] },
        availByDay: { '2026-06-08': day, '2026-06-09': day },
        weekTotal: 4, capacity: 40, remaining: 36, overCapacity: false, paidHours: 4,
        availableHoursByDay: { '2026-06-08': 8, '2026-06-09': 8 },
      },
    ],
  };

  const renderGrid = (highlightJobId?: string | null) =>
    render(<CrewHoursGrid model={twoJobModel} canEdit highlightJobId={highlightJobId}
      onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);

  it('marks the selected job\'s chips on and every other chip off', () => {
    renderGrid('staffed');
    expect(screen.getByTitle('J-1 · Staffed')).toHaveAttribute('data-highlight', 'on');
    for (const chip of screen.getAllByTitle('J-3 · Other')) {
      expect(chip).toHaveAttribute('data-highlight', 'off');
    }
  });

  it('highlights only the members working the selected job', () => {
    renderGrid('staffed');
    expect(screen.getByTestId('crew-member-m1')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('crew-member-m2')).not.toHaveAttribute('data-highlighted');
  });

  it('leaves the grid untouched when no job is selected', () => {
    const { rerender } = renderGrid(null);
    const assertNoHighlight = () => {
      for (const chip of [screen.getByTitle('J-1 · Staffed'), ...screen.getAllByTitle('J-3 · Other')]) {
        expect(chip).not.toHaveAttribute('data-highlight');
      }
      expect(screen.getByTestId('crew-member-m1')).not.toHaveAttribute('data-highlighted');
      expect(screen.getByTestId('crew-member-m2')).not.toHaveAttribute('data-highlighted');
    };
    assertNoHighlight();
    // Omitting the prop entirely behaves the same as passing null.
    rerender(<CrewHoursGrid model={twoJobModel} canEdit
      onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    assertNoHighlight();
  });

  it('drops the highlight when the selection moves to another job', () => {
    const { rerender } = renderGrid('staffed');
    rerender(<CrewHoursGrid model={twoJobModel} canEdit highlightJobId="other"
      onAssignWeek={vi.fn()} onEditDay={vi.fn()} onRemoveDay={vi.fn()} onDropJobOnMember={vi.fn()} />);
    expect(screen.getByTitle('J-1 · Staffed')).toHaveAttribute('data-highlight', 'off');
    // Both members work "Other", so both light up now.
    expect(screen.getByTestId('crew-member-m1')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('crew-member-m2')).toHaveAttribute('data-highlighted', 'true');
  });
});
