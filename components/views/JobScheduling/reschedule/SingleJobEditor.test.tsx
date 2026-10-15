import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SingleJobEditor } from './SingleJobEditor';
import type { ProposedChange } from '../../../../services/scheduleEngine';

const change: ProposedChange = {
  jobId: 'a', jobName: 'Exterior Repaint', jobNumber: '0001',
  oldStart: '2026-06-02T08:00:00', oldEnd: '2026-06-02T17:00:00',
  newStart: '2026-06-02T08:00:00', newEnd: '2026-06-04T17:00:00',
};

const base = {
  change, clientName: 'Acme Co', issues: [], suggestions: [], onAutoFix: vi.fn(),
  stats: { workOrderNumber: 'WO-100', estHours: 40, assignedHours: 24, renderedHours: 0 },
  crew: [{ id: 'm1', name: 'Mike Smith', role: 'Owner' }],
  onReassignCrew: vi.fn(),
  dayHours: { '2026-06-02': { startTime: '08:00', endTime: '17:00' } },
  onChangeDailyHour: vi.fn(), onChangeJobDate: vi.fn(),
};

describe('SingleJobEditor', () => {
  it('shows the When start/end date fields and the crew', () => {
    render(<SingleJobEditor {...base} />);
    expect(screen.getByText('Start Date')).toBeInTheDocument();
    expect(screen.getByText('End Date')).toBeInTheDocument();
    expect(screen.getByText('Mike Smith')).toBeInTheDocument();
  });

  it('uses single-job framing — no "Jobs Affected" bulk tile', () => {
    render(<SingleJobEditor {...base} />);
    expect(screen.queryByText('Jobs Affected')).not.toBeInTheDocument();
  });

  it('fires onReassignCrew from the Edit crew button', () => {
    render(<SingleJobEditor {...base} />);
    fireEvent.click(screen.getByRole('button', { name: /edit crew/i }));
    expect(base.onReassignCrew).toHaveBeenCalledWith('a');
  });

  it('shows the estimate as the total and assigned as progress', () => {
    render(<SingleJobEditor {...base} />);
    expect(screen.getByText('Total Est. Hours')).toBeInTheDocument();
    expect(screen.getByText('40.0')).toBeInTheDocument();
    expect(screen.getByText('24.0')).toBeInTheDocument();
  });

  it('labels actual hours as "logged", not "Rendered", when there are any', () => {
    render(<SingleJobEditor {...base} stats={{ ...base.stats, renderedHours: 8 }} />);
    expect(screen.getByText('8.0 logged')).toBeInTheDocument();
    expect(screen.queryByText('Rendered')).not.toBeInTheDocument();
  });

  it('renders the cascade toggle and calls onToggleCascade', () => {
    const onToggleCascade = vi.fn();
    render(<SingleJobEditor {...base} cascade={false} onToggleCascade={onToggleCascade} followingJobs={[]} />);
    fireEvent.click(screen.getByRole('button', { name: /cascade following jobs/i }));
    expect(onToggleCascade).toHaveBeenCalledWith(true);
  });

  it('shows a summary of following jobs when cascade is on and the start moved', () => {
    const moved: ProposedChange = { ...change, oldStart: '2026-06-04T08:00:00', oldEnd: '2026-06-04T17:00:00', newStart: '2026-06-06T08:00:00', newEnd: '2026-06-06T17:00:00' };
    const followingJobs: ProposedChange[] = [
      { jobId: 'j2', jobName: 'Miller Exterior', jobNumber: 'J-2', oldStart: '2026-06-05T08:00:00', oldEnd: '2026-06-05T17:00:00', newStart: '2026-06-07T08:00:00', newEnd: '2026-06-07T17:00:00' },
    ];
    render(<SingleJobEditor {...base} change={moved} cascade={true} onToggleCascade={vi.fn()} followingJobs={followingJobs} />);
    expect(screen.getByText(/1 later job will shift by \+2 days/i)).toBeInTheDocument();
    expect(screen.getByText(/Miller Exterior/)).toBeInTheDocument();
  });

  it('shows no following-jobs summary when cascade is off', () => {
    render(<SingleJobEditor {...base} cascade={false} onToggleCascade={vi.fn()} followingJobs={[]} />);
    expect(screen.queryByText(/later job/i)).not.toBeInTheDocument();
  });

  it('skips non-working days a re-flow spans, showing only working days', () => {
    // Fri Jun 5 -> Mon Jun 8 2026, with Sat/Sun (6,0) disabled in settings.
    const friToMon = { ...change, newStart: '2026-06-05T08:00:00', newEnd: '2026-06-08T17:00:00' };
    const { container } = render(
      <SingleJobEditor {...base} change={friToMon}
        dayHours={{
          '2026-06-05': { startTime: '08:00', endTime: '17:00' },
          '2026-06-08': { startTime: '08:00', endTime: '17:00' },
        }}
        nonWorkingWeekdays={[0, 6]} />,
    );
    // Only the two working days (Fri, Mon) => 2 rows => 4 time inputs. The weekend
    // it re-flows across is skipped, not shown.
    expect(container.querySelectorAll('input[type="time"]')).toHaveLength(4);
    expect(screen.getByText(/Fri, Jun 5/)).toBeInTheDocument();
    expect(screen.getByText(/Mon, Jun 8/)).toBeInTheDocument();
    expect(screen.queryByText(/Sat, Jun 6/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sun, Jun 7/)).not.toBeInTheDocument();
    expect(screen.queryByText(/non-working/i)).not.toBeInTheDocument();
  });
});

describe('SingleJobEditor start-time routing', () => {
  it('re-flows the first-day start immediately on change', () => {
    const onShiftStartTime = vi.fn();
    const { container } = render(
      <SingleJobEditor {...base} onShiftStartTime={onShiftStartTime} onChangeDailyHour={vi.fn()} />,
    );
    const start = container.querySelectorAll('input[type="time"]')[0];
    fireEvent.focus(start);
    fireEvent.change(start, { target: { value: '12:00' } });
    expect(onShiftStartTime).toHaveBeenCalledWith('a', '2026-06-02', '12:00');
  });

  it('keeps the typed value while focused when the re-flow re-seeds the window (no revert)', () => {
    const { container, rerender } = render(<SingleJobEditor {...base} onShiftStartTime={vi.fn()} />);
    const start = () => container.querySelectorAll('input[type="time"]')[0] as HTMLInputElement;
    fireEvent.focus(start());
    fireEvent.change(start(), { target: { value: '12:00' } });
    expect(start().value).toBe('12:00');
    // The live re-flow re-seeds the field's source value (here, back to its original
    // 08:00). While focused, the field must hold the typed value, not revert.
    rerender(<SingleJobEditor {...base} onShiftStartTime={vi.fn()} />);
    expect(start().value).toBe('12:00');
  });

  it('adopts the external value once focus leaves and the re-flow result is in', () => {
    const { container, rerender } = render(<SingleJobEditor {...base} onShiftStartTime={vi.fn()} />);
    const start = () => container.querySelectorAll('input[type="time"]')[0] as HTMLInputElement;
    fireEvent.focus(start());
    fireEvent.change(start(), { target: { value: '09:30' } });
    fireEvent.blur(start(), { target: { value: '09:30' } });
    // After blur, the re-flowed/re-seeded window value is adopted.
    rerender(
      <SingleJobEditor {...base} onShiftStartTime={vi.fn()}
        dayHours={{ '2026-06-02': { startTime: '10:00', endTime: '17:00' } }} />,
    );
    expect(start().value).toBe('10:00');
  });

  it('does not shift when the first-day start is set to its current value', () => {
    const onShiftStartTime = vi.fn();
    const { container } = render(
      <SingleJobEditor {...base} onShiftStartTime={onShiftStartTime} onChangeDailyHour={vi.fn()} />,
    );
    const start = container.querySelectorAll('input[type="time"]')[0];
    fireEvent.focus(start);
    // base.change.newStart is 08:00; re-emitting the same value is a no-op shift.
    fireEvent.change(start, { target: { value: '08:00' } });
    expect(onShiftStartTime).not.toHaveBeenCalled();
  });

  it('edits a later day start as a local window change, not a shift', () => {
    const onShiftStartTime = vi.fn();
    const onChangeDailyHour = vi.fn();
    const { container } = render(
      <SingleJobEditor {...base} onShiftStartTime={onShiftStartTime} onChangeDailyHour={onChangeDailyHour} />,
    );
    const timeInputs = container.querySelectorAll('input[type="time"]');
    fireEvent.change(timeInputs[2], { target: { value: '09:00' } });
    expect(onChangeDailyHour).toHaveBeenCalledWith('a', '2026-06-03', 'startTime', '09:00');
    expect(onShiftStartTime).not.toHaveBeenCalled();
  });

  it('edits the first day end time as a local window change, not a shift', () => {
    const onShiftStartTime = vi.fn();
    const onChangeDailyHour = vi.fn();
    const { container } = render(
      <SingleJobEditor {...base} onShiftStartTime={onShiftStartTime} onChangeDailyHour={onChangeDailyHour} />,
    );
    const timeInputs = container.querySelectorAll('input[type="time"]');
    fireEvent.change(timeInputs[1], { target: { value: '15:00' } });
    expect(onChangeDailyHour).toHaveBeenCalledWith('a', '2026-06-02', 'endTime', '15:00');
    expect(onShiftStartTime).not.toHaveBeenCalled();
  });

  it('renders the conflicting-jobs card and Move button when there are resolutions', () => {
    const onMoveConflicts = vi.fn();
    render(
      <SingleJobEditor
        {...base}
        conflictResolutions={[
          { jobId: 'b', jobName: 'Fence Job', jobNumber: '0002', kind: 'slide-same-day',
            change: { ...change, jobId: 'b' }, label: 'Move Fence Job to 1:00 PM–3:00 PM' },
        ]}
        onMoveConflicts={onMoveConflicts}
      />,
    );
    expect(screen.getByText('Move Fence Job to 1:00 PM–3:00 PM')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /move conflicting job/i }));
    expect(onMoveConflicts).toHaveBeenCalled();
  });

  it('hides the Move button when the only conflict is a locked job', () => {
    render(
      <SingleJobEditor
        {...base}
        conflictResolutions={[
          { jobId: 'b', jobName: 'Fence Job', jobNumber: '0002', kind: 'locked-blocked',
            change: { ...change, jobId: 'b' }, label: "Fence Job is locked and can't be moved" },
        ]}
        onMoveConflicts={vi.fn()}
      />,
    );
    expect(screen.getByText("Fence Job is locked and can't be moved")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /move conflicting job/i })).not.toBeInTheDocument();
  });

  it('renders no conflicting-jobs card when there are no resolutions', () => {
    render(<SingleJobEditor {...base} />);
    expect(screen.queryByRole('button', { name: /move conflicting job/i })).not.toBeInTheDocument();
  });

  it('renders an unresolved conflict as a note with no Move button', () => {
    render(
      <SingleJobEditor
        {...base}
        conflictResolutions={[
          { jobId: 'b', jobName: 'Fence Job', jobNumber: '0002', kind: 'unresolved',
            change: { ...change, jobId: 'b' }, label: "Fence Job can't fit on Jun 17 — reschedule manually" },
        ]}
        onMoveConflicts={vi.fn()}
      />,
    );
    expect(screen.getByText("Fence Job can't fit on Jun 17 — reschedule manually")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /move conflicting job/i })).not.toBeInTheDocument();
  });

  it('shows the Move button for a move-to-day resolution', () => {
    const onMoveConflicts = vi.fn();
    render(
      <SingleJobEditor
        {...base}
        conflictResolutions={[
          { jobId: 'b', jobName: 'Fence Job', jobNumber: '0002', kind: 'move-to-day',
            change: { ...change, jobId: 'b' }, label: 'Move Fence Job to Tue, Jun 16, 8:00 AM–11:00 AM' },
        ]}
        onMoveConflicts={onMoveConflicts}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /move conflicting job/i }));
    expect(onMoveConflicts).toHaveBeenCalled();
  });

  it('shows green "No conflicts" only when there are no advisories and no resolutions', () => {
    render(<SingleJobEditor {...base} issues={[]} conflictResolutions={[]} />);
    expect(screen.getByText('No conflicts')).toBeInTheDocument();
  });

  it('shows a non-overlap advisory (due-date) as a note, with no green box', () => {
    render(
      <SingleJobEditor
        {...base}
        issues={[{ jobId: 'a', jobName: 'Exterior Repaint', kind: 'past-due', severity: 'high',
          message: 'Exterior Repaint ends after the customer due date (June 18, 2026)' }]}
        conflictResolutions={[]}
      />,
    );
    expect(screen.getByText('Exterior Repaint ends after the customer due date (June 18, 2026)')).toBeInTheDocument();
    expect(screen.queryByText('No conflicts')).not.toBeInTheDocument();
  });

  it('hides the duplicate double-book row and the Auto-Fix strip when a conflict card is shown', () => {
    render(
      <SingleJobEditor
        {...base}
        issues={[{ jobId: 'a', jobName: 'Exterior Repaint', kind: 'double-book', severity: 'high',
          message: 'Exterior Repaint overlaps Downtown Commercial on the same crew that day' }]}
        suggestions={[{ id: 's1', jobId: 'a', label: 'Move Exterior Repaint to June 25, 2026', change }]}
        conflictResolutions={[
          { jobId: 'dc', jobName: 'Downtown Commercial', jobNumber: '0003', kind: 'unresolved',
            change: { ...change, jobId: 'dc' }, label: "Downtown Commercial can't fit on June 18, 2026 — reschedule manually" },
        ]}
      />,
    );
    // Conflict card content is present...
    expect(screen.getByText("Downtown Commercial can't fit on June 18, 2026 — reschedule manually")).toBeInTheDocument();
    // ...but the duplicate overlap row, the Auto-Fix button, and the green box are gone.
    expect(screen.queryByText('Exterior Repaint overlaps Downtown Commercial on the same crew that day')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /auto-fix/i })).not.toBeInTheDocument();
    expect(screen.queryByText('No conflicts')).not.toBeInTheDocument();
  });

  it('mixed: keeps the non-overlap advisory and the card, drops the overlap row (screenshot case)', () => {
    render(
      <SingleJobEditor
        {...base}
        issues={[
          { jobId: 'a', jobName: 'Exterior Repaint', kind: 'past-due', severity: 'high',
            message: 'Exterior Repaint ends after the customer due date (June 18, 2026)' },
          { jobId: 'a', jobName: 'Exterior Repaint', kind: 'double-book', severity: 'high',
            message: 'Exterior Repaint overlaps Downtown Commercial on the same crew that day' },
        ]}
        conflictResolutions={[
          { jobId: 'dc', jobName: 'Downtown Commercial', jobNumber: '0003', kind: 'unresolved',
            change: { ...change, jobId: 'dc' }, label: "Downtown Commercial can't fit on June 18, 2026 — reschedule manually" },
        ]}
      />,
    );
    expect(screen.getByText('Exterior Repaint ends after the customer due date (June 18, 2026)')).toBeInTheDocument();
    expect(screen.getByText("Downtown Commercial can't fit on June 18, 2026 — reschedule manually")).toBeInTheDocument();
    expect(screen.queryByText('Exterior Repaint overlaps Downtown Commercial on the same crew that day')).not.toBeInTheDocument();
    expect(screen.queryByText('No conflicts')).not.toBeInTheDocument();
  });
});

describe('SingleJobEditor — manage shifts mode', () => {
  const manage = {
    shifts: [
      { id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-07-14', endDate: '2026-07-14', startTime: '08:00', endTime: '12:00' },
      { id: 's2', name: 'Finish', memberIds: ['m1'], startDate: '2026-07-15', endDate: '2026-07-15', startTime: '08:00', endTime: '12:00' },
    ],
    allStaff: [{ id: 'm1', name: 'Mike Smith' }] as any,
    weekendDays: [0, 6], canDelete: true,
    onAddShift: vi.fn(), onRenameShift: vi.fn(), onDeleteShift: vi.fn(),
    onChangeSpan: vi.fn(), onChangeDayWindow: vi.fn(), onEditMembers: vi.fn(),
  };

  it('renders the shift cards + Add shift, not the job-level daily-hours block', () => {
    render(<SingleJobEditor {...base} manage={manage} />);
    expect(screen.getByText('Prep')).toBeInTheDocument();
    expect(screen.getByText('Finish')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add shift/i })).toBeInTheDocument();
  });

  it('calls onAddShift from the drawer', () => {
    const onAddShift = vi.fn();
    render(<SingleJobEditor {...base} manage={{ ...manage, onAddShift }} />);
    fireEvent.click(screen.getByRole('button', { name: /add shift/i }));
    expect(onAddShift).toHaveBeenCalledOnce();
  });
});

describe('SingleJobEditor — moving the whole schedule', () => {
  const manage = {
    shifts: [
      { id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-07-14', endDate: '2026-07-14', startTime: '08:00', endTime: '12:00' },
      { id: 's2', name: 'Finish', memberIds: ['m1'], startDate: '2026-07-15', endDate: '2026-07-15', startTime: '08:00', endTime: '12:00' },
    ],
    allStaff: [{ id: 'm1', name: 'Mike Smith' }] as any,
    weekendDays: [0, 6], canDelete: true,
    onAddShift: vi.fn(), onRenameShift: vi.fn(), onDeleteShift: vi.fn(),
    onChangeSpan: vi.fn(), onChangeDayWindow: vi.fn(), onEditMembers: vi.fn(),
    // Calendar-day stand-in: the real preview counts working days.
    previewMoveDays: (days: number) => manage.shifts.map(sh => {
      const slide = (key: string) => {
        const d = new Date(`${key}T12:00:00`);
        d.setDate(d.getDate() + days);
        return d.toISOString().slice(0, 10);
      };
      return {
        id: sh.id, name: sh.name,
        from: { startDate: sh.startDate, endDate: sh.endDate },
        to: { startDate: slide(sh.startDate), endDate: slide(sh.endDate) },
      };
    }),
  };

  it('opens the move modal from the sidebar button, not an inline stepper', () => {
    render(<SingleJobEditor {...base} manage={{ ...manage, onMoveDays: vi.fn() }} />);
    expect(screen.queryByText('Direction')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /move schedule/i }));
    expect(screen.getByText('Direction')).toBeInTheDocument();
  });

  it('disables the button when every shift is worked history', () => {
    const pinned = manage.shifts.map(sh => ({ ...sh, pinned: true as const }));
    render(<SingleJobEditor {...base} manage={{ ...manage, shifts: pinned, onMoveDays: vi.fn() }} />);
    expect(screen.getByRole('button', { name: /move schedule/i })).toBeDisabled();
  });

  it('stays out of the way when the caller offers no move handler', () => {
    render(<SingleJobEditor {...base} manage={manage} />);
    expect(screen.queryByRole('button', { name: /move schedule/i })).toBeNull();
  });
});
