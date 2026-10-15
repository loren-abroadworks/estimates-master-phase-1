import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CrewSelectionModal } from './CrewSelectionModal';
import type { CrewMember } from '../../types';

const staff: CrewMember[] = [
  { id: 'm1', name: 'Mike Smith', role: 'Owner' },
  { id: 'm2', name: 'Jessica Miller', role: 'Estimator' },
];

const base = {
  isOpen: true,
  onClose: vi.fn(),
  onSave: vi.fn(),
  allStaff: staff,
  existingJobs: [],
  simplified: true as const,
};

describe('CrewSelectionModal — unscheduled job (no start date)', () => {
  it('hides the per-day hours grid and shows a schedule-first note', () => {
    render(<CrewSelectionModal {...base} currentCrew={[staff[0]]} />);
    expect(screen.getByText('Schedule the job to assign daily hours.')).toBeInTheDocument();
    expect(screen.queryByText('In This Shift')).toBeNull();
    expect(screen.queryByText('Total Man Hours')).toBeNull();
  });

  it('saves the selected members with no dates or hours', () => {
    const onSave = vi.fn();
    render(<CrewSelectionModal {...base} onSave={onSave} currentCrew={[staff[0]]} />);
    fireEvent.click(screen.getByText('Save Crew'));
    expect(onSave).toHaveBeenCalledTimes(1);
    const allocation = onSave.mock.calls[0][1];
    expect(allocation.memberIds).toEqual(['m1']);
    expect(allocation.startDate).toBeUndefined();
    expect(allocation.endDate).toBeUndefined();
    expect(allocation.hoursAssignments).toBeUndefined();
  });
});

describe('CrewSelectionModal — scheduled job', () => {
  it('shows the per-day hours grid (with a date column) when the job has a start date', () => {
    render(
      <CrewSelectionModal
        {...base}
        currentCrew={[staff[0]]}
        jobStartDate="2026-06-08T08:00:00"
        jobEndDate="2026-06-08T17:00:00"
      />,
    );
    expect(screen.queryByText('Schedule the job to assign daily hours.')).toBeNull();
    expect(screen.getByText('Crew Member')).toBeInTheDocument();
    expect(screen.getByText('In This Shift')).toBeInTheDocument();
    expect(screen.getByText('Total Man Hours')).toBeInTheDocument();
  });
});

describe('CrewSelectionModal — full modal (Job Scheduling shift)', () => {
  const alloc = {
    id: 'shift-1',
    name: 'General Crew',
    memberIds: [],
    startDate: '2026-07-13',
    endDate: '2026-07-16',
    startTime: '08:00',
    endTime: '17:00',
  };
  const fullBase = {
    isOpen: true as const,
    onClose: vi.fn(),
    onSave: vi.fn(),
    allStaff: staff,
    existingJobs: [],
    jobStartDate: '2026-07-13T08:00:00',
    jobEndDate: '2026-07-16T17:00:00',
    allocationToEdit: alloc,
    hideWorkOrder: true as const,
  };

  it('hides the Work Order card and labels the range fields', () => {
    render(<CrewSelectionModal {...fullBase} currentCrew={[]} />);
    // The old "Shift dates" heading is gone: name and both dates share one row, so the
    // field labels carry the meaning.
    expect(screen.getByText('Start Date')).toBeInTheDocument();
    expect(screen.getByText('End Date')).toBeInTheDocument();
    expect(screen.queryByText('Work Order')).toBeNull();
  });

  it('headlines the shift range and its length in the stats card', () => {
    render(<CrewSelectionModal {...fullBase} currentCrew={[]} />);
    expect(screen.getByText('Scheduled For')).toBeInTheDocument();
    expect(screen.getByText('Jul 13 – Jul 16, 2026')).toBeInTheDocument();
    expect(screen.getAllByText('4 days').length).toBeGreaterThan(0);
  });

  it('shows the draft grid total as ASSIGNED when the caller tracks no job-wide figure', () => {
    // Two members x 4 weekdays x 9h shift window = 72h once the grid is seeded.
    render(<CrewSelectionModal {...fullBase} currentCrew={staff} allocationToEdit={{ ...alloc, memberIds: ['m1', 'm2'] }} />);
    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByText('72.0')).toBeInTheDocument();
  });

  it('shows the crew grid (not the unscheduled note) even without job dates', () => {
    // The full modal has its own date pickers, so it must not fall back to the
    // "schedule the job first" empty state the simplified modal uses.
    render(
      <CrewSelectionModal
        {...fullBase}
        currentCrew={[]}
        jobStartDate={undefined}
        jobEndDate={undefined}
        allocationToEdit={{ ...alloc, startDate: '', endDate: '' }}
      />,
    );
    expect(screen.queryByText('Schedule the job to assign daily hours.')).toBeNull();
    expect(screen.getByText('Crew Member')).toBeInTheDocument();
  });

  it('uses the provided title and confirm-label overrides', () => {
    render(<CrewSelectionModal {...fullBase} currentCrew={[]} title="Add shift" confirmLabel="Assign shift" />);
    expect(screen.getByText('Add shift')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assign shift' })).toBeInTheDocument();
  });

  it('passes existing per-member window overrides through a save untouched', () => {
    // The grid doesn't edit member windows (that lives in the Assign Hours modal), but
    // saving the shift must not silently drop overrides made there.
    const onSave = vi.fn();
    render(
      <CrewSelectionModal
        {...fullBase}
        onSave={onSave}
        currentCrew={[staff[0]]}
        allocationToEdit={{ ...alloc, memberIds: ['m1'],
          memberDailyWindows: { m1: { '2026-07-13': { startTime: '09:00', endTime: '13:00' } } } }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Schedule' }));
    const allocation = onSave.mock.calls[0][1];
    expect(allocation.memberDailyWindows).toEqual({ m1: { '2026-07-13': { startTime: '09:00', endTime: '13:00' } } });
  });

  it('keeps an edited day start time through a parent re-render', () => {
    // The modal seeds its own draft from props on open. A parent re-render hands it a
    // fresh `currentCrew` array reference; the seed effect must NOT re-run and wipe edits.
    // Times now live per-day in the day list, so index 0 is the FIRST DAY's start time.
    const { container, rerender } = render(<CrewSelectionModal {...fullBase} currentCrew={[]} />);
    const startInput = () => container.querySelectorAll('input[type="time"]')[0] as HTMLInputElement;
    expect(startInput().value).toBe('08:00');

    fireEvent.change(startInput(), { target: { value: '09:30' } });
    expect(startInput().value).toBe('09:30');

    rerender(<CrewSelectionModal {...fullBase} currentCrew={[]} />);
    expect(startInput().value).toBe('09:30');
  });
});

describe('CrewSelectionModal — capacity roll-ups', () => {
  // One day, two members, 08:00–17:00 → a 9h shift window each, seeded full.
  const renderOneDay = () =>
    render(
      <CrewSelectionModal
        {...base}
        currentCrew={staff}
        jobStartDate="2026-06-10T08:00:00"
        jobEndDate="2026-06-10T17:00:00"
      />,
    );

  const shiftMeter = (name: string) =>
    screen.getByTitle(`Hours assigned to ${name} in this shift, out of the shift window`);
  const weeklyMeter = (name: string) =>
    screen.getByTitle(`Everything ${name} is committed to this week, out of their standard working hours`);
  // The nth cell's "Xh left" / "Xh over" figure. It sits beside the day's window on the
  // first line of the breakdown, so it is the second span — any further spans belong to
  // the other jobs listed below it. Scoped to the cell because the meters use the same
  // wording off a different basis.
  const cellCaption = (i: number) => {
    const wrap = screen.getAllByRole('spinbutton')[i].parentElement as HTMLElement;
    return wrap.querySelectorAll('span')[1]?.textContent;
  };

  it('measures each member against the shift window, not a standard day', () => {
    renderOneDay();
    expect(shiftMeter('Mike')).toHaveTextContent('9/9h');
  });

  // "Left" has to mean one thing on this screen. The shift column counts against the
  // shift's own window, the week and the cells against the person's day — three rulers,
  // and three different "left" figures for the same member. Only the person's rulers
  // keep the wording; the shift column states what it holds and stops there.
  it('leaves "hours left" to the figures measured against the person', () => {
    renderOneDay();
    expect(shiftMeter('Mike')).not.toHaveTextContent('left');
    expect(weeklyMeter('Mike')).toHaveTextContent('31h left');
  });

  // Over is a different claim: it means the shift asks more of the day than the window
  // holds, which is worth flagging wherever it happens.
  it('still calls out a shift booked past its own window', () => {
    renderOneDay();
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '11' } });
    expect(shiftMeter('Mike')).toHaveTextContent('2h over');
  });

  it('measures each member against their standard working week', () => {
    renderOneDay();
    expect(weeklyMeter('Mike')).toHaveTextContent('9/40h');
    expect(weeklyMeter('Mike')).toHaveTextContent('31h left');
  });

  it('uses the configured daily capacity, so it matches the crew hours grid', () => {
    // Job Scheduling runs on a 9h day (08:00–17:00) → a 45h week, not 40h.
    render(
      <CrewSelectionModal
        {...base}
        currentCrew={staff}
        dailyCapacityHours={9}
        jobStartDate="2026-06-10T08:00:00"
        jobEndDate="2026-06-10T17:00:00"
      />,
    );
    expect(weeklyMeter('Mike')).toHaveTextContent('9/45h');
    expect(weeklyMeter('Mike')).toHaveTextContent('36h left');
    // A 9h day is now exactly a full day, so the cell reads empty rather than over.
    expect(cellCaption(0)).toBe('0h left');
  });

  it('chips each day with this shift and the whole roster', () => {
    renderOneDay();
    const shiftChip = screen.getByTitle('Hours assigned to this shift on this day, out of the crew’s shift window');
    const allCrewChip = screen.getByTitle('Hours every crew member is committed to on this day across all jobs, out of the full roster’s hours');
    expect(shiftChip).toHaveTextContent('Shift 18/18h');
    expect(allCrewChip).toHaveTextContent('All crew 18/18h');
  });

  it('measures each cell against the member’s day, not the shift window', () => {
    renderOneDay();
    // Seeded full: a 9h window is 1h past a standard 8h day for both members.
    expect(cellCaption(0)).toBe('1h over');
    expect(cellCaption(1)).toBe('1h over');
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '4' } });
    // 8h day − 4h here = 4h, even though the 9h shift window still has 5h open.
    expect(cellCaption(0)).toBe('4h left');
  });

  it('agrees with the weekly meter, which is what the crew picker shows', () => {
    renderOneDay();
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '4' } });
    // The single day's 4h left is the slice of the week's 36h that this day contributes.
    expect(weeklyMeter('Mike')).toHaveTextContent('4/40h');
    expect(weeklyMeter('Mike')).toHaveTextContent('36h left');
    expect(cellCaption(0)).toBe('4h left');
  });

  it('counts hours the member owes other jobs against the cell', () => {
    const other = [{
      id: 'j9', name: 'Other job',
      allocations: [{
        id: 'a9', name: 'Crew', memberIds: ['m1'],
        startDate: '2026-06-10', endDate: '2026-06-10',
        hoursAssignments: { m1: { '2026-06-10': 6 } },
      }],
    }] as any;
    render(
      <CrewSelectionModal
        {...base}
        existingJobs={other}
        currentCrew={staff}
        jobStartDate="2026-06-10T08:00:00"
        jobEndDate="2026-06-10T17:00:00"
      />,
    );
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '2' } });
    // Mike: 6h elsewhere + 2h here fills his day exactly.
    expect(cellCaption(0)).toBe('0h left');
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '4' } });
    expect(cellCaption(0)).toBe('2h over');
  });

  it('updates the member, week and day roll-ups when a cell changes', () => {
    renderOneDay();
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '4' } });
    expect(shiftMeter('Mike')).toHaveTextContent('4/9h');
    expect(weeklyMeter('Mike')).toHaveTextContent('4/40h');
    expect(screen.getByTitle('Hours assigned to this shift on this day, out of the crew’s shift window')).toHaveTextContent('Shift 13/18h');
  });

  it('reports hours past the shift window in the meter, and past the day in the cell', () => {
    renderOneDay();
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '12' } });
    expect(shiftMeter('Mike')).toHaveTextContent('12/9h');
    expect(shiftMeter('Mike')).toHaveTextContent('3h over'); // 12h against the 9h window
    expect(cellCaption(0)).toBe('4h over');                  // 12h against his 8h day
  });
});

describe('CrewSelectionModal — transfer picker', () => {
  const openPicker = () =>
    fireEvent.click(screen.getByPlaceholderText('Search to add crew member...'));

  it('opens the two-panel picker when the search bar is clicked', () => {
    render(<CrewSelectionModal {...base} currentCrew={[]} />);
    openPicker();
    expect(screen.getByRole('region', { name: 'Available' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Added' })).toBeInTheDocument();
  });

  it('moves a member into the Added panel via Add', () => {
    render(<CrewSelectionModal {...base} currentCrew={[]} />);
    openPicker();
    const added = screen.getByRole('region', { name: 'Added' });
    expect(within(added).queryByText('Mike Smith')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add Mike Smith' }));
    expect(within(added).getByText('Mike Smith')).toBeInTheDocument();
  });

  // Add/Remove in the picker write straight through to the draft, so leaving by Cancel
  // has to put the roster back the way it was found.
  it('discards picks made in the panel when Cancel is clicked', () => {
    render(<CrewSelectionModal {...base} currentCrew={[staff[0]]}
      jobStartDate="2026-06-10T08:00:00" jobEndDate="2026-06-10T17:00:00" />);
    openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Add Jessica Miller' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    // Back in the shift editor, with the crew as it stood before the panel opened.
    expect(screen.queryByRole('region', { name: 'Available' })).toBeNull();
    expect(screen.getByText('Mike')).toBeInTheDocument();
    expect(screen.queryByText('Jessica')).toBeNull();
  });

  it('keeps picks made in the panel when Add is clicked', () => {
    render(<CrewSelectionModal {...base} currentCrew={[staff[0]]}
      jobStartDate="2026-06-10T08:00:00" jobEndDate="2026-06-10T17:00:00" />);
    openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Add Jessica Miller' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Jessica')).toBeInTheDocument();
  });

  it('shows the same weekly figure in the picker as in the grid’s weekly column', () => {
    render(
      <CrewSelectionModal
        {...base}
        currentCrew={staff}
        jobStartDate="2026-06-10T08:00:00"
        jobEndDate="2026-06-10T17:00:00"
      />,
    );
    // Drop Mike's seeded 9h to 4h, then read the same number in both places.
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '4' } });
    const weekly = screen.getByTitle('Everything Mike is committed to this week, out of their standard working hours');
    expect(weekly).toHaveTextContent('4/40h');

    openPicker();
    const added = screen.getByRole('region', { name: 'Added' });
    expect(within(added).getByText('4')).toBeInTheDocument();
    expect(within(added).getByText('36h left')).toBeInTheDocument();
  });

  it('returns to the main scheduling view when Done is clicked', () => {
    render(
      <CrewSelectionModal
        {...base}
        currentCrew={[]}
        jobStartDate="2026-06-08T08:00:00"
        jobEndDate="2026-06-08T17:00:00"
      />,
    );
    openPicker();
    fireEvent.click(screen.getByRole('button', { name: 'Add Mike Smith' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.queryByRole('region', { name: 'Available' })).toBeNull();
    // The picked crew persists into the scheduling view (the grid appears).
    expect(screen.getByText('In This Shift')).toBeInTheDocument();
  });
});

describe('CrewSelectionModal — shift day list', () => {
  const spanning = {
    id: 'shift-1', name: 'General Crew', memberIds: ['m1'],
    startDate: '2026-08-19', endDate: '2026-08-21',   // Wed → Fri
    startTime: '08:00', endTime: '17:00',
  };
  const dayBase = {
    isOpen: true as const,
    onClose: vi.fn(),
    onSave: vi.fn(),
    allStaff: staff,
    existingJobs: [],
    jobStartDate: '2026-08-19T08:00:00',
    jobEndDate: '2026-08-21T17:00:00',
    hideWorkOrder: true as const,
    currentCrew: [staff[0]],
  };

  it('seeds removed days and per-day windows from the shift being edited', () => {
    render(<CrewSelectionModal {...dayBase} allocationToEdit={{
      ...spanning,
      skipDays: ['2026-08-20'],
      dailyHours: { '2026-08-21': { startTime: '07:00', endTime: '12:00' } },
    }} />);
    expect(screen.getAllByRole('button', { name: 'Remove day' })).toHaveLength(2);
    // The removed day keeps a row, so it can be put back without re-picking the dates.
    expect(screen.getByText('Thu, Aug 20')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore day' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('07:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12:00')).toBeInTheDocument();
  });

  // Removed days occupy rows now, so a bare "2 days" beside three rows would read as a
  // miscount. The badge names both numbers instead.
  it('shows worked days against the full range in the day badge', () => {
    render(<CrewSelectionModal {...dayBase} allocationToEdit={{ ...spanning, skipDays: ['2026-08-20'] }} />);
    expect(screen.getAllByText('2 of 3 days').length).toBeGreaterThan(0);
    expect(screen.queryByText('3 days')).toBeNull();
  });

  it('shows a plain day count when nothing is removed', () => {
    render(<CrewSelectionModal {...dayBase} allocationToEdit={spanning} />);
    expect(screen.getAllByText('3 days').length).toBeGreaterThan(0);
  });

  it('round-trips skipDays and dailyHours through onSave', () => {
    const onSave = vi.fn();
    render(<CrewSelectionModal {...dayBase} onSave={onSave} allocationToEdit={{
      ...spanning,
      skipDays: ['2026-08-20'],
      dailyHours: { '2026-08-21': { startTime: '07:00', endTime: '12:00' } },
    }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Schedule' }));
    const payload = onSave.mock.calls[0][1];
    expect(payload.skipDays).toEqual(['2026-08-20']);
    // Only days that genuinely differ from the default are persisted. Aug 19 follows the
    // default, which the editor now shows, so it needs no entry — and materializing it
    // would make it reopen as "Custom".
    expect(payload.dailyHours).toEqual({
      '2026-08-21': { startTime: '07:00', endTime: '12:00' },
    });
    // The shift's own clock IS the default window.
    expect([payload.startTime, payload.endTime]).toEqual(['08:00', '17:00']);
  });

  it('drops dailyHours entirely when every day follows the default', () => {
    const onSave = vi.fn();
    render(<CrewSelectionModal {...dayBase} onSave={onSave} allocationToEdit={spanning} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Schedule' }));
    expect(onSave.mock.calls[0][1].dailyHours).toBeUndefined();
  });

  it('a new default applies to every untouched day and is what gets saved', () => {
    const onSave = vi.fn();
    render(<CrewSelectionModal {...dayBase} onSave={onSave} allocationToEdit={{
      ...spanning,
      dailyHours: { '2026-08-21': { startTime: '07:00', endTime: '12:00' } },
    }} />);
    fireEvent.change(screen.getByLabelText('Default start'), { target: { value: '09:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Schedule' }));
    const payload = onSave.mock.calls[0][1];
    expect([payload.startTime, payload.endTime]).toEqual(['09:00', '17:00']);
    // The hand-set day is untouched by the default change.
    expect(payload.dailyHours).toEqual({ '2026-08-21': { startTime: '07:00', endTime: '12:00' } });
  });

  it('Apply to all drops every override so the default governs all days', () => {
    const onSave = vi.fn();
    render(<CrewSelectionModal {...dayBase} onSave={onSave} allocationToEdit={{
      ...spanning,
      dailyHours: { '2026-08-21': { startTime: '07:00', endTime: '12:00' } },
    }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply to all days' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Schedule' }));
    expect(onSave.mock.calls[0][1].dailyHours).toBeUndefined();
  });

  // Shifts saved by the previous code path materialized EVERY day into dailyHours. Those
  // entries must not read back as hand-set, or the whole card badges "Custom".
  it('ignores legacy per-day entries that merely repeat the default', () => {
    const onSave = vi.fn();
    render(<CrewSelectionModal {...dayBase} onSave={onSave} allocationToEdit={{
      ...spanning,
      dailyHours: {
        '2026-08-19': { startTime: '08:00', endTime: '17:00' },
        '2026-08-20': { startTime: '08:00', endTime: '17:00' },
        '2026-08-21': { startTime: '08:00', endTime: '17:00' },
      },
    }} />);
    expect(screen.queryByText('Custom')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Schedule' }));
    expect(onSave.mock.calls[0][1].dailyHours).toBeUndefined();
  });

  it('removing an interior day saves it as a skipped day, range unchanged', () => {
    const onSave = vi.fn();
    render(<CrewSelectionModal {...dayBase} onSave={onSave} allocationToEdit={spanning} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove day' })[1]); // Aug 20
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Schedule' }));
    const payload = onSave.mock.calls[0][1];
    expect(payload.skipDays).toEqual(['2026-08-20']);
    expect([payload.startDate, payload.endDate]).toEqual(['2026-08-19', '2026-08-21']);
  });

  // Removing a boundary day used to narrow the range AND drop the skip with it, so the
  // only undo was re-picking the dates — which readmitted every other removed day too.
  // The range now holds while editing, and the row stays restorable.
  it('removing the first day leaves the range alone and keeps the day restorable', () => {
    render(<CrewSelectionModal {...dayBase} allocationToEdit={spanning} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove day' })[0]); // Aug 19
    expect(screen.getByText('Wed, Aug 19')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restore day' })).toBeInTheDocument();
    expect(screen.getAllByText('2 of 3 days').length).toBeGreaterThan(0);
    // The date pickers are untouched — the envelope is what the user set.
    expect(screen.getByText('8/19/2026')).toBeInTheDocument();
    expect(screen.getByText('8/21/2026')).toBeInTheDocument();
  });

  it('restores an accidentally removed boundary day with its times intact', () => {
    const onSave = vi.fn();
    render(<CrewSelectionModal {...dayBase} onSave={onSave} allocationToEdit={{
      ...spanning, dailyHours: { '2026-08-19': { startTime: '06:00', endTime: '10:00' } },
    }} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove day' })[0]); // Aug 19
    fireEvent.click(screen.getByRole('button', { name: 'Restore day' }));
    // Back as it was — the window survived the removal.
    expect(screen.getByDisplayValue('06:00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Schedule' }));
    const payload = onSave.mock.calls[0][1];
    expect(payload.startDate).toBe('2026-08-19');
    expect(payload.skipDays).toEqual([]);
  });

  // Removing a day one at a time no longer walks the range inward, so removing two ends
  // and restoring one does not require re-entering any dates.
  it('survives removing both ends and restoring one', () => {
    const onSave = vi.fn();
    render(<CrewSelectionModal {...dayBase} onSave={onSave} allocationToEdit={spanning} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove day' })[0]); // Aug 19
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove day' })[1]); // Aug 21
    expect(screen.getAllByRole('button', { name: 'Restore day' })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Restore day' })[0]); // Aug 19 back
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Schedule' }));
    const payload = onSave.mock.calls[0][1];
    // Persisted shape is still the trimmed one: Aug 21 stayed out, so the range ends Aug 20.
    expect([payload.startDate, payload.endDate]).toEqual(['2026-08-19', '2026-08-20']);
    expect(payload.skipDays).toEqual([]);
  });

  it('disables the hours cell on a removed day', () => {
    render(<CrewSelectionModal {...dayBase} allocationToEdit={{
      ...spanning, memberIds: ['m1'], skipDays: ['2026-08-20'],
    }} />);
    const cells = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    expect(cells.map(c => c.disabled)).toEqual([false, true, false]);
    expect(screen.getByText('Not in shift')).toBeInTheDocument();
  });

  it('keeps a removed day\'s per-member hours, so widening the range restores them', () => {
    const onSave = vi.fn();
    render(<CrewSelectionModal {...dayBase} onSave={onSave} allocationToEdit={{
      ...spanning, memberIds: ['m1'],
      hoursAssignments: { m1: { '2026-08-19': 9, '2026-08-20': 9, '2026-08-21': 9 } },
    }} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove day' })[1]); // remove Aug 20
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Schedule' }));
    const payload = onSave.mock.calls[0][1];
    expect(payload.skipDays).toEqual(['2026-08-20']);
    // Guard, don't purge: the hours survive the skip.
    expect(payload.hoursAssignments.m1['2026-08-20']).toBe(9);
  });

  it('blocks saving when every day is skipped', () => {
    const onSave = vi.fn();
    render(<CrewSelectionModal {...dayBase} onSave={onSave} allocationToEdit={{
      ...spanning, skipDays: ['2026-08-19', '2026-08-20', '2026-08-21'],
    }} />);
    expect(screen.getByText('Select at least one day to schedule this shift.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Schedule' }));
    expect(onSave).not.toHaveBeenCalled();
  });
});


describe('CrewSelectionModal — a member\'s own day, in the cell', () => {
  const shift = {
    id: 'shift-1', name: 'Paint', memberIds: ['m1'],
    startDate: '2026-08-19', endDate: '2026-08-19',   // one Wednesday
    startTime: '13:00', endTime: '17:00',
  };
  const cellBase = {
    isOpen: true as const,
    onClose: vi.fn(),
    onSave: vi.fn(),
    allStaff: staff,
    jobStartDate: '2026-08-19T08:00:00',
    jobEndDate: '2026-08-19T17:00:00',
    hideWorkOrder: true as const,
    currentCrew: [staff[0]],
  };
  // Another job already holding Mike's morning.
  const otherJob = {
    id: 'j2', jobNumber: 'J-2', name: 'Fence Repair', stage: 'Scheduled',
    allocations: [{
      id: 'a2', name: 'Morning', startDate: '2026-08-19', endDate: '2026-08-19',
      startTime: '08:00', endTime: '12:00', memberIds: ['m1'],
    }],
  } as never;
  const cell = () => screen.getAllByRole('spinbutton')[0].parentElement as HTMLElement;
  // The breakdown is a portaled tooltip: hover the cell (the <td>), then read it.
  const hoverCell = (i = 0) => {
    const td = screen.getAllByRole('spinbutton')[i].closest('td') as HTMLElement;
    fireEvent.mouseEnter(td);
    return screen.getByRole('tooltip');
  };

  // The shift's window was the same down every column, which made it decoration. What
  // differs per row — and what the scheduler is deciding against — is the person's day.
  it('shows the hours the MEMBER works, not the shift window', () => {
    render(<CrewSelectionModal {...cellBase} existingJobs={[]} allocationToEdit={shift}
      availabilityWindow={{ startTime: '07:00', endTime: '15:30' }} />);
    expect(screen.getByText('7am–3:30pm')).toBeInTheDocument();
    expect(screen.queryByText('1pm–5pm')).toBeNull();
  });

  it('prefers the member\'s own window over the company default', () => {
    const partTime: CrewMember = {
      ...staff[0],
      schedule: { '2026-08-19': { date: '2026-08-19', startTime: '08:00', endTime: '12:00', isOff: false } },
    };
    render(<CrewSelectionModal {...cellBase} allStaff={[partTime, staff[1]]} currentCrew={[partTime]}
      existingJobs={[]} allocationToEdit={shift} />);
    expect(screen.getByText('8am–12pm')).toBeInTheDocument();
  });

  it('says why the day is unavailable when the member is off', () => {
    const away: CrewMember = {
      ...staff[0],
      schedule: { '2026-08-19': { date: '2026-08-19', startTime: '08:00', endTime: '17:00', isOff: true, reason: 'PTO' } },
    };
    render(<CrewSelectionModal {...cellBase} allStaff={[away, staff[1]]} currentCrew={[away]}
      existingJobs={[]} allocationToEdit={shift} />);
    expect(screen.getByText('PTO')).toBeInTheDocument();
  });

  it('reports what the day has left, counting everything on it', () => {
    render(<CrewSelectionModal {...cellBase} existingJobs={[otherJob]} allocationToEdit={shift} />);
    // 4h here + 4h on the other job fills an 8h standard day.
    expect(cell()).toHaveTextContent('0h left');
  });

  // The job side of the day is the follow-up question, so it lives on hover.
  it('puts this shift and every other booking in the tooltip', () => {
    render(<CrewSelectionModal {...cellBase} existingJobs={[otherJob]} allocationToEdit={shift} />);
    const tip = hoverCell();
    expect(tip).toHaveTextContent('Paint: 1pm–5pm · 4h');
    expect(tip).toHaveTextContent('Fence Repair · Morning: 8am–12pm · 4h');
    expect(tip).toHaveTextContent('8 of 8h');
  });

  // The caption prints the member's window (8am–5pm, nine hours) beside what the day has
  // left, which is measured net of unpaid lunch. Without the lunch line the two numbers
  // look like they should reconcile and don't.
  it('names the unpaid break the day\'s capacity is short by', () => {
    render(<CrewSelectionModal {...cellBase} existingJobs={[]} allocationToEdit={shift}
      dailyCapacityHours={8.5}
      defaultBreaks={[{ id: 'b1', label: 'Lunch', durationMinutes: 30, paid: false, startTime: '12:00' }]} />);
    expect(hoverCell()).toHaveTextContent('Lunch 0.5h unpaid');
  });

  it('leaves paid breaks out of it — they are inside the working day', () => {
    render(<CrewSelectionModal {...cellBase} existingJobs={[]} allocationToEdit={shift}
      defaultBreaks={[{ id: 'b1', label: 'Coffee', durationMinutes: 15, paid: true }]} />);
    expect(hoverCell()).not.toHaveTextContent('unpaid');
  });

  it('dismisses the tooltip when the pointer leaves', () => {
    render(<CrewSelectionModal {...cellBase} existingJobs={[]} allocationToEdit={shift} />);
    const td = screen.getAllByRole('spinbutton')[0].closest('td') as HTMLElement;
    fireEvent.mouseEnter(td);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(td);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  // WHEN, not how much: 4h at 6am is still before this member starts.
  it('flags a window that falls outside the hours they work', () => {
    render(<CrewSelectionModal {...cellBase} existingJobs={[]}
      allocationToEdit={{ ...shift, startTime: '06:00', endTime: '10:00',
        dailyHours: { '2026-08-19': { startTime: '06:00', endTime: '10:00' } } }} />);
    // Inline, so it reads without hovering; the tooltip repeats it with the window.
    expect(screen.getByText('8am–5pm')).toHaveClass('text-orange-600');
    expect(hoverCell()).toHaveTextContent('Outside 8am–5pm');
  });

  it('leaves the tooltip off a day the shift skips', () => {
    render(<CrewSelectionModal {...cellBase}
      jobEndDate="2026-08-20T17:00:00" existingJobs={[]}
      allocationToEdit={{ ...shift, endDate: '2026-08-20', skipDays: ['2026-08-20'] }} />);
    expect(screen.getByText('Not in shift')).toBeInTheDocument();
    const skipped = screen.getAllByRole('spinbutton')[1].closest('td') as HTMLElement;
    fireEvent.mouseEnter(skipped);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});

describe('CrewSelectionModal — a shift where only one member has granular hours', () => {
  // The shape the bug needed: three on the shift, one edited day on m1. Any single
  // per-day edit anywhere creates hoursAssignments, and the picker used to take that as
  // "everyone's hours are in here" — showing the other two blank, then saving the blank.
  const alloc = {
    id: 'shift-cutroll',
    name: 'Cut & Roll',
    memberIds: ['m1', 'm2'],
    startDate: '2026-08-18',
    endDate: '2026-08-19',
    startTime: '13:00',
    endTime: '17:00',
    hoursAssignments: { m1: { '2026-08-19': 4 } },
  };
  const props = {
    isOpen: true as const,
    onClose: vi.fn(),
    onSave: vi.fn(),
    allStaff: staff,
    existingJobs: [],
    jobStartDate: '2026-08-18T13:00:00',
    jobEndDate: '2026-08-19T17:00:00',
    allocationToEdit: alloc,
    hideWorkOrder: true as const,
  };

  it('opens with the implicit member showing the hours the board shows them working', () => {
    render(<CrewSelectionModal {...props} currentCrew={staff} />);
    const cells = screen.getAllByPlaceholderText('-') as HTMLInputElement[];
    const values = cells.map(c => c.value);
    // Four cells: m1 Tue (unset), m1 Wed (4, granular), m2 Tue + Wed (4 each, implicit).
    expect(values.filter(v => v === '4')).toHaveLength(3);
  });

  it('saves the implicit member\'s hours instead of wiping them', () => {
    const onSave = vi.fn();
    render(<CrewSelectionModal {...props} onSave={onSave} currentCrew={staff} />);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Schedule' }));
    const saved = onSave.mock.calls[0][1];
    expect(saved.hoursAssignments.m2).toEqual({ '2026-08-18': 4, '2026-08-19': 4 });
  });
});

describe('CrewSelectionModal — the warning triangle says why', () => {
  // m1 is off on Aug 18 but still carries 4h; m2 is booked 9h into a 4h shift window.
  const alloc = {
    id: 'shift-why', name: 'Cut & Roll', memberIds: ['m1', 'm2'],
    startDate: '2026-08-18', endDate: '2026-08-18',
    startTime: '13:00', endTime: '17:00',
    hoursAssignments: { m1: { '2026-08-18': 4 }, m2: { '2026-08-18': 9 } },
  };
  const offMike: CrewMember = { ...staff[0], schedule: {
    '2026-08-18': { date: '2026-08-18', startTime: '08:00', endTime: '17:00', isOff: true, reason: 'Vacation' },
  } };
  const props = {
    isOpen: true as const,
    onClose: vi.fn(),
    onSave: vi.fn(),
    allStaff: [offMike, staff[1]],
    existingJobs: [],
    jobStartDate: '2026-08-18T13:00:00',
    jobEndDate: '2026-08-18T17:00:00',
    allocationToEdit: alloc,
    hideWorkOrder: true as const,
  };

  const hoverCell = (value: string) => {
    const input = (screen.getAllByPlaceholderText('-') as HTMLInputElement[]).find(i => i.value === value)!;
    fireEvent.mouseEnter(input.closest('td')!);
    return screen.getByRole('tooltip');
  };

  it('names the member being off, with their reason', () => {
    render(<CrewSelectionModal {...props} currentCrew={[offMike, staff[1]]} />);
    expect(hoverCell('4')).toHaveTextContent('Mike Smith is off this day · Vacation');
  });

  it('spells out hours booked past the day the member works', () => {
    render(<CrewSelectionModal {...props} currentCrew={[offMike, staff[1]]} />);
    // m2 works a standard 8h day and is booked 9h.
    expect(hoverCell('9')).toHaveTextContent('1h past the 8h they work this day');
  });

  it('spells out hours booked past the shift window', () => {
    render(<CrewSelectionModal {...props} currentCrew={[offMike, staff[1]]} />);
    // The shift runs 1–5pm: a 4h window holding 9h.
    expect(hoverCell('9')).toHaveTextContent('5h past this shift\'s 4h window');
  });
});

describe('CrewSelectionModal — company work hours from settings', () => {
  it('derives a new shift\'s window and the availability captions from availabilityWindow', () => {
    // A 7am–3pm company day: the seeded day window and every member's availability
    // caption must follow it — nothing may fall back to a hardcoded 8–5.
    const { container } = render(
      <CrewSelectionModal
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        allStaff={staff}
        existingJobs={[]}
        currentCrew={[staff[0]]}
        jobStartDate="2026-06-10T07:00:00"
        jobEndDate="2026-06-10T15:00:00"
        hideWorkOrder
        availabilityWindow={{ startTime: '07:00', endTime: '15:00' }}
      />,
    );
    const dayStart = container.querySelectorAll('input[type="time"]')[0] as HTMLInputElement;
    expect(dayStart.value).toBe('07:00');
    expect(screen.getAllByText('7am–3pm').length).toBeGreaterThan(0);
    expect(screen.queryByText('8am–5pm')).toBeNull();
  });
});

describe('CrewSelectionModal — footer man hours', () => {
  const renderWithEstimate = (estHours?: number) =>
    render(
      <CrewSelectionModal
        {...base}
        currentCrew={[staff[0]]}
        jobStartDate="2026-06-10T08:00:00"
        jobEndDate="2026-06-10T17:00:00"
        estHours={estHours}
      />,
    );

  it('shows the job estimate beside the assigned total, with the hours still open', () => {
    // One member, one 9h weekday seeded → 9h assigned of a 40h estimate. The weekly
    // meter can echo the same "…h left" figure, so scope to the estimate's own block.
    renderWithEstimate(40);
    expect(screen.getByText('Total Man Hours')).toBeInTheDocument();
    const estBlock = screen.getByText('Estimated Hours').parentElement as HTMLElement;
    expect(within(estBlock).getByText('40h')).toBeInTheDocument();
    expect(within(estBlock).getByText('31h left')).toBeInTheDocument();
  });

  it('flags assigned hours past the estimate as over', () => {
    // 9h assigned against a 4h estimate → 5h over.
    renderWithEstimate(4);
    expect(screen.getByText('4h')).toBeInTheDocument();
    expect(screen.getByText('5h over')).toBeInTheDocument();
  });

  it('shows only the assigned total when the caller has no estimate', () => {
    renderWithEstimate(undefined);
    expect(screen.getByText('Total Man Hours')).toBeInTheDocument();
    expect(screen.queryByText('Estimated Hours')).toBeNull();
  });
});

describe('CrewSelectionModal — Assign Hours popup opened from a member name', () => {
  const alloc = {
    id: 'shift-1',
    name: 'Cut & Roll',
    memberIds: ['m1'],
    startDate: '2026-07-13',
    endDate: '2026-07-16',
    startTime: '08:00',
    endTime: '17:00',
  };
  const renderShift = (props: Record<string, unknown> = {}) =>
    render(
      <CrewSelectionModal
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        allStaff={staff}
        existingJobs={[]}
        jobStartDate="2026-07-13T08:00:00"
        jobEndDate="2026-07-16T17:00:00"
        allocationToEdit={alloc}
        currentCrew={[staff[0]]}
        hideWorkOrder
        {...props}
      />,
    );

  const openPopup = () => fireEvent.click(screen.getByRole('button', { name: 'Assign hours to Mike Smith' }));

  it('opens the popup with a row per worked day of the shift', () => {
    renderShift();
    openPopup();
    expect(screen.getByText('Assign Hours — Mike Smith')).toBeInTheDocument();
    // Mon 13 – Thu 16, seeded from the 8–5 shift window.
    expect(screen.getByLabelText(/hours on mon 13/i)).toHaveTextContent('9');
    expect(screen.getByLabelText(/hours on thu 16/i)).toHaveTextContent('9');
  });

  it('leaves a skipped day out of the popup', () => {
    renderShift({ allocationToEdit: { ...alloc, skipDays: ['2026-07-14'] } });
    openPopup();
    expect(screen.queryByLabelText(/hours on tue 14/i)).toBeNull();
    expect(screen.getByLabelText(/hours on wed 15/i)).toBeInTheDocument();
  });

  it('writes the hours it computes into the draft grid without saving the shift', () => {
    const onSave = vi.fn();
    renderShift({ onSave });
    openPopup();
    // Monday retimed to 8–12: 4h, computed from the window rather than typed.
    fireEvent.change(screen.getByLabelText(/end time on mon 13/i), { target: { value: '12:00' } });
    fireEvent.click(screen.getByRole('button', { name: /^assign$/i }));

    // Popup closed, Monday's grid cell took the new figure, nothing persisted yet.
    expect(screen.queryByText('Assign Hours — Mike Smith')).toBeNull();
    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(4);
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Schedule' }));
    expect(onSave.mock.calls[0][1].hoursAssignments.m1['2026-07-13']).toBe(4);
  });

  it('removing a day in the popup drops it from the draft', () => {
    const onSave = vi.fn();
    renderShift({ onSave });
    openPopup();
    fireEvent.click(screen.getByRole('button', { name: /remove mon 13/i }));
    fireEvent.click(screen.getByRole('button', { name: /^assign$/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Schedule' }));

    const hours = onSave.mock.calls[0][1].hoursAssignments.m1;
    expect(hours['2026-07-13']).toBeUndefined();
    expect(hours['2026-07-14']).toBe(9);
  });

  it('saves a day retimed in the popup as that member\'s own window', () => {
    const onSave = vi.fn();
    renderShift({ onSave });
    openPopup();
    // 08:00 → 13:00 on Monday: the popup re-derives 5h from the shorter window.
    fireEvent.change(screen.getByLabelText(/end time on mon 13/i), { target: { value: '13:00' } });
    fireEvent.click(screen.getByRole('button', { name: /^assign$/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Schedule' }));

    const allocation = onSave.mock.calls[0][1];
    expect(allocation.hoursAssignments.m1['2026-07-13']).toBe(5);
    expect(allocation.memberDailyWindows.m1['2026-07-13']).toEqual({ startTime: '08:00', endTime: '13:00' });
    // Only the day that was retimed becomes an override.
    expect(allocation.memberDailyWindows.m1['2026-07-14']).toBeUndefined();
  });

  it('reopens the popup showing the member window it saved earlier', () => {
    renderShift({
      allocationToEdit: {
        ...alloc,
        memberDailyWindows: { m1: { '2026-07-13': { startTime: '09:00', endTime: '13:00' } } },
      },
    });
    openPopup();
    expect(screen.getByLabelText(/start time on mon 13/i)).toHaveValue('09:00');
    expect(screen.getByLabelText(/end time on mon 13/i)).toHaveValue('13:00');
  });

  it('warns when the entered hours push the member past their week', () => {
    renderShift({ dailyCapacityHours: 8, weekendDays: [0, 6] });
    openPopup();
    // Monday stretched to 8:00–23:00 (15h) against a 40h week (4 x 8h): 15 + the other
    // three 9h days is over.
    fireEvent.change(screen.getByLabelText(/end time on mon 13/i), { target: { value: '23:00' } });
    expect(screen.getByText(/over capacity this week/i)).toBeInTheDocument();
  });
});

describe('CrewSelectionModal — the popup reads the job, not just the shift', () => {
  const alloc = {
    id: 'shift-1',
    name: 'Cut & Roll',
    memberIds: ['m1'],
    startDate: '2026-07-13',
    endDate: '2026-07-16',
    startTime: '08:00',
    endTime: '17:00',
  };
  const renderShift = (props: Record<string, unknown> = {}) =>
    render(
      <CrewSelectionModal
        isOpen
        onClose={vi.fn()}
        onSave={vi.fn()}
        allStaff={staff}
        existingJobs={[]}
        jobStartDate="2026-07-13T08:00:00"
        jobEndDate="2026-07-16T17:00:00"
        allocationToEdit={alloc}
        currentCrew={[staff[0]]}
        hideWorkOrder
        jobRef={{ jobNumber: 'JOB-2024-012', name: 'Downtown Commercial' }}
        {...props}
      />,
    );
  const openPopup = () => fireEvent.click(screen.getByRole('button', { name: 'Assign hours to Mike Smith' }));

  it('names the job in the locked picker', () => {
    renderShift();
    openPopup();
    const picker = screen.getByLabelText(/job/i);
    expect(within(picker).getByRole('option')).toHaveTextContent('JOB-2024-012 — Downtown Commercial');
    expect(picker).toBeDisabled();
  });

  it('counts the job\'s other shifts in the Job Hours readout', () => {
    // 80h already on other shifts + this draft's 4 x 9h = 116h of a 150h estimate.
    renderShift({ otherShiftsHours: 80, estHours: 150 });
    openPopup();
    const row = screen.getByText('Job Hours').parentElement as HTMLElement;
    expect(within(row).getByText('116h')).toBeInTheDocument();
    expect(within(row).getByText('of 150h')).toBeInTheDocument();
    expect(within(row).getByText('34h still needed')).toBeInTheDocument();
  });

  it('opens the break editor from a day row and saves to the member', () => {
    const onEditMember = vi.fn();
    renderShift({ onEditMember });
    openPopup();
    fireEvent.click(screen.getByRole('button', { name: /add break on mon 13/i }));
    expect(screen.getByText('Breaks · Mike Smith')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onEditMember).toHaveBeenCalledTimes(1);
    expect(onEditMember.mock.calls[0][0].id).toBe('m1');
  });

  it('hides the break controls when the caller cannot persist a member', () => {
    renderShift();
    openPopup();
    expect(screen.queryByRole('button', { name: /add break on mon 13/i })).toBeNull();
  });
});
