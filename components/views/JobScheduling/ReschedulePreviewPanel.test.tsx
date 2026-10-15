import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ReschedulePreviewPanel } from './ReschedulePreviewPanel';
import type { StagedReschedule } from '../../../services/reschedulePreview';
import type { RescheduleImpact } from '../../../services/rescheduleImpact';
import type { ProposedChange } from '../../../services/scheduleEngine';

const change: ProposedChange = {
  jobId: 'a', jobName: 'Exterior Repaint', jobNumber: '0001',
  oldStart: '2026-06-02T08:00:00.000Z', oldEnd: '2026-06-02T16:00:00.000Z',
  newStart: '2026-06-04T08:00:00.000Z', newEnd: '2026-06-04T16:00:00.000Z',
};

const impact: RescheduleImpact = {
  jobsAffected: 1, crewsAffected: 2, totalDelayDays: 2,
  affectedJobNames: ['Exterior Repaint'], affectedCrewNames: ['Exteriors A', 'Interiors B'],
  newEndDate: '2026-06-04T16:00:00.000Z', lockedCount: 1,
  weatherHits: [{ dateKey: '2026-06-04', kind: 'rain', jobCount: 1 }],
  customerUpdates: [{ clientId: 'cl1', clientName: 'Acme Co', jobName: 'Exterior Repaint', oldStart: change.oldStart, newStart: change.newStart }],
};

const baseStaged = (over: Partial<StagedReschedule> = {}): StagedReschedule => ({
  changes: [change], label: 'Move Exterior Repaint', commit: vi.fn(), mode: 'bulk', ...over,
});

const noop = () => {};

describe('ReschedulePreviewPanel', () => {
  it('renders schedule impact stats from impact', () => {
    render(<ReschedulePreviewPanel staged={baseStaged()} issues={[]} suggestions={[]} impact={impact} onApply={noop} onCancel={noop} onAutoFix={noop} />);
    expect(screen.getByText('Jobs Affected')).toBeInTheDocument();
    expect(screen.getByText('Crews Affected')).toBeInTheDocument();
    expect(screen.getByText('1 locked')).toBeInTheDocument();
  });

  it('hides the Delay-by control when recompute is absent', () => {
    render(<ReschedulePreviewPanel staged={baseStaged()} issues={[]} suggestions={[]} impact={impact} onApply={noop} onCancel={noop} onAutoFix={noop} />);
    expect(screen.queryByText('Delay by')).not.toBeInTheDocument();
  });

  it('shows the Delay-by control and fires onChangeDelay when recompute is present', () => {
    const onChangeDelay = vi.fn();
    render(<ReschedulePreviewPanel staged={baseStaged({ recompute: () => [change], delayDays: 2 })} issues={[]} suggestions={[]} impact={impact} onApply={noop} onCancel={noop} onAutoFix={noop} onChangeDelay={onChangeDelay} />);
    expect(screen.getByText('Delay by')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '5' } });
    expect(onChangeDelay).toHaveBeenCalledWith(5);
  });

  it('previews Auto-Fix changes from the conflict strip, then confirms them on Apply', () => {
    const suggestions = [
      { id: 's1', jobId: 'a', label: 'Move Exterior Repaint to June 5, 2026', change },
    ];
    const onAutoFix = vi.fn();
    render(<ReschedulePreviewPanel staged={baseStaged()} issues={[]} suggestions={suggestions} impact={impact} onApply={noop} onCancel={noop} onAutoFix={onAutoFix} />);

    fireEvent.click(screen.getByRole('button', { name: /^auto-fix$/i }));
    expect(screen.getByText('Auto-Fix will make 1 change')).toBeInTheDocument();
    expect(screen.getByText('• Move Exterior Repaint to June 5, 2026')).toBeInTheDocument();
    expect(screen.queryByText(/Auto-Fix applied/)).not.toBeInTheDocument();
    expect(onAutoFix).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Apply Auto-Fix'));
    expect(onAutoFix).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Auto-Fix applied 1 change')).toBeInTheDocument();
  });

  it('renders a day row per spanned day and fires onChangeDailyHour on edit', () => {
    const multiDay = { ...change, newStart: '2026-06-02T08:00:00', newEnd: '2026-06-04T17:00:00' };
    const staged: StagedReschedule = { changes: [multiDay], label: 'Move', commit: vi.fn(), mode: 'edit' };
    const onChangeDailyHour = vi.fn();
    const edits = { a: {
      '2026-06-02': { startTime: '08:00', endTime: '17:00' },
      '2026-06-03': { startTime: '08:00', endTime: '17:00' },
      '2026-06-04': { startTime: '08:00', endTime: '17:00' },
    } };
    const { container } = render(
      <ReschedulePreviewPanel staged={staged} issues={[]} suggestions={[]} impact={impact} onApply={noop} onCancel={noop} onAutoFix={noop} dailyHoursEdits={edits} onChangeDailyHour={onChangeDailyHour} />,
    );
    const times = container.querySelectorAll('input[type="time"]');
    expect(times).toHaveLength(6);
    fireEvent.change(times[0], { target: { value: '09:30' } });
    expect(onChangeDailyHour).toHaveBeenCalledWith('a', '2026-06-02', 'startTime', '09:30');
  });

  it('renders start/end date pickers seeded from the change and fires onChangeJobDate', () => {
    const multiDay = { ...change, newStart: '2026-06-02T08:00:00', newEnd: '2026-06-04T17:00:00' };
    const staged: StagedReschedule = { changes: [multiDay], label: 'Move', commit: vi.fn(), mode: 'edit' };
    const onChangeJobDate = vi.fn();
    render(
      <ReschedulePreviewPanel staged={staged} issues={[]} suggestions={[]} impact={impact} onApply={noop} onCancel={noop} onAutoFix={noop} onChangeDailyHour={vi.fn()} onChangeJobDate={onChangeJobDate} />,
    );
    // Each picker shows its seeded date as a locale string in the trigger.
    const startLabel = new Date('2026-06-02T00:00:00').toLocaleDateString();
    const endLabel = new Date('2026-06-04T00:00:00').toLocaleDateString();
    expect(screen.getByText(startLabel)).toBeInTheDocument();
    expect(screen.getByText(endLabel)).toBeInTheDocument();
    // Open the start picker and pick the 5th — fires the start change.
    fireEvent.click(screen.getByText(startLabel));
    fireEvent.click(screen.getByRole('button', { name: '5' }));
    expect(onChangeJobDate).toHaveBeenCalledWith('a', 'start', '2026-06-05');
  });

  it('shows assigned crew members with names in the crew section', () => {
    const staged: StagedReschedule = { changes: [change], label: 'Move', commit: vi.fn(), mode: 'edit' };
    const crewByJob = { a: [{ id: 'm1', name: 'Mike Smith' }, { id: 'm2', name: 'David Chen' }] };
    render(
      <ReschedulePreviewPanel staged={staged} issues={[]} suggestions={[]} impact={impact} onApply={noop} onCancel={noop} onAutoFix={noop} onChangeDailyHour={vi.fn()} crewByJob={crewByJob} />,
    );
    expect(screen.getByText('Crew')).toBeInTheDocument();
    expect(screen.getByText('Mike Smith')).toBeInTheDocument();
    expect(screen.getByText('David Chen')).toBeInTheDocument();
  });

  it('fires onReassignCrew when the Edit crew button is clicked', () => {
    const staged: StagedReschedule = { changes: [change], label: 'Move', commit: vi.fn(), mode: 'edit' };
    const crewByJob = { a: [{ id: 'm1', name: 'Mike Smith' }] };
    const onReassignCrew = vi.fn();
    render(
      <ReschedulePreviewPanel staged={staged} issues={[]} suggestions={[]} impact={impact} onApply={noop} onCancel={noop} onAutoFix={noop} onChangeDailyHour={vi.fn()} crewByJob={crewByJob} onReassignCrew={onReassignCrew} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /edit crew/i }));
    expect(onReassignCrew).toHaveBeenCalledWith('a');
  });

  it('renders the compact impact stats section in edit mode', () => {
    const staged: StagedReschedule = { changes: [change], label: 'Move', commit: vi.fn(), mode: 'edit' };
    const statsByJob = { a: { workOrderNumber: 'WO-100', estHours: 40, assignedHours: 18, renderedHours: 8 } };
    render(
      <ReschedulePreviewPanel staged={staged} issues={[]} suggestions={[]} impact={impact} onApply={noop} onCancel={noop} onAutoFix={noop} onChangeDailyHour={vi.fn()} statsByJob={statsByJob} />,
    );
    expect(screen.getByText('Impact')).toBeInTheDocument();
    expect(screen.getByText('#WO-100')).toBeInTheDocument();
    expect(screen.getByText('40.0')).toBeInTheDocument();
  });

  it('expands customer messages on Preview Messages click', () => {
    render(<ReschedulePreviewPanel staged={baseStaged()} issues={[]} suggestions={[]} impact={impact} onApply={noop} onCancel={noop} onAutoFix={noop} />);
    fireEvent.click(screen.getByText('Preview Messages'));
    expect(screen.getByText(/has been rescheduled/)).toBeInTheDocument();
  });

  it('edit mode shows "Edit Schedule" header and the When fields, not bulk tiles', () => {
    render(<ReschedulePreviewPanel staged={baseStaged({ mode: 'edit' })} issues={[]} suggestions={[]} impact={impact}
      onApply={noop} onCancel={noop} onAutoFix={noop}
      onChangeJobDate={() => {}} onChangeDailyHour={() => {}}
      dailyHoursEdits={{ a: { '2026-06-04': { startTime: '08:00', endTime: '17:00' } } }}
      crewByJob={{ a: [{ id: 'm1', name: 'Mike Smith', role: 'Owner' }] }}
      statsByJob={{ a: { workOrderNumber: 'WO-100', estHours: 40, assignedHours: 24, renderedHours: 0 } }} />);
    expect(screen.getByText('Edit Schedule')).toBeInTheDocument();
    expect(screen.getByText('Start Date')).toBeInTheDocument();
    expect(screen.queryByText('Jobs Affected')).not.toBeInTheDocument();
  });

  it('shows the Cascade toggle when moving an already-scheduled job', () => {
    const staged: StagedReschedule = { changes: [change], label: 'Move', commit: vi.fn(), mode: 'edit', primaryJobId: 'a' };
    render(
      <ReschedulePreviewPanel staged={staged} issues={[]} suggestions={[]} impact={impact} onApply={noop} onCancel={noop} onAutoFix={noop}
        onChangeJobDate={() => {}} onChangeDailyHour={() => {}} cascade={false} onToggleCascade={vi.fn()} />,
    );
    expect(screen.getByText('Cascade following jobs')).toBeInTheDocument();
  });

  it('hides the Cascade toggle when placing a job that had no prior start date', () => {
    const placement: ProposedChange = { ...change, oldStart: null, oldEnd: null };
    const staged: StagedReschedule = { changes: [placement], label: 'Move', commit: vi.fn(), mode: 'edit', primaryJobId: 'a' };
    render(
      <ReschedulePreviewPanel staged={staged} issues={[]} suggestions={[]} impact={impact} onApply={noop} onCancel={noop} onAutoFix={noop}
        onChangeJobDate={() => {}} onChangeDailyHour={() => {}} cascade={false} onToggleCascade={vi.fn()} />,
    );
    expect(screen.queryByText('Cascade following jobs')).not.toBeInTheDocument();
  });

  it('shows "Keep existing days as-is" only when cascade is on and fires its toggle', () => {
    const staged: StagedReschedule = { changes: [change], label: 'Move', commit: vi.fn(), mode: 'edit', primaryJobId: 'a' };
    const onToggleKeepDays = vi.fn();
    const { rerender } = render(
      <ReschedulePreviewPanel staged={staged} issues={[]} suggestions={[]} impact={impact} onApply={noop} onCancel={noop} onAutoFix={noop}
        onChangeJobDate={() => {}} onChangeDailyHour={() => {}} cascade={false} onToggleCascade={vi.fn()}
        keepExistingDaysAsIs={false} onToggleKeepExistingDays={onToggleKeepDays} />);
    expect(screen.queryByText('Keep existing days as-is')).not.toBeInTheDocument();

    rerender(
      <ReschedulePreviewPanel staged={staged} issues={[]} suggestions={[]} impact={impact} onApply={noop} onCancel={noop} onAutoFix={noop}
        onChangeJobDate={() => {}} onChangeDailyHour={() => {}} cascade={true} onToggleCascade={vi.fn()}
        keepExistingDaysAsIs={false} onToggleKeepExistingDays={onToggleKeepDays} />);
    fireEvent.click(screen.getByLabelText('Keep existing days as-is'));
    expect(onToggleKeepDays).toHaveBeenCalledWith(true);
  });

  it('bulk mode shows "Reschedule Preview" header and impact tiles', () => {
    render(<ReschedulePreviewPanel staged={baseStaged({ mode: 'bulk' })} issues={[]} suggestions={[]} impact={impact}
      onApply={noop} onCancel={noop} onAutoFix={noop} />);
    expect(screen.getByText('Reschedule Preview')).toBeInTheDocument();
    expect(screen.getByText('Jobs Affected')).toBeInTheDocument();
  });

  it('shows conflict resolutions and fires onMoveConflicts in edit mode', () => {
    const onMoveConflicts = vi.fn();
    render(
      <ReschedulePreviewPanel
        staged={baseStaged({ mode: 'edit', primaryJobId: 'a' })}
        issues={[]}
        suggestions={[]}
        impact={impact}
        onApply={noop}
        onCancel={noop}
        onAutoFix={noop}
        conflictResolutions={[
          { jobId: 'b', jobName: 'Fence Job', jobNumber: '0002', kind: 'slide-same-day',
            change: { ...change, jobId: 'b' }, label: 'Move Fence Job to 12:00 PM–3:00 PM' },
        ]}
        onMoveConflicts={onMoveConflicts}
      />,
    );
    expect(screen.getByText('Move Fence Job to 12:00 PM–3:00 PM')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /move conflicting job/i }));
    expect(onMoveConflicts).toHaveBeenCalled();
  });
});
