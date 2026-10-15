import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobsPanel } from './JobsPanel';
import type { JobSummary } from '../../../services/crewHoursGrid';

const summary = (over: Partial<JobSummary> = {}): JobSummary => ({
  jobId: 'j1', jobNumber: 'J-1', jobName: 'Exterior Repaint', address: '1 Main St',
  color: '#10b981', estimate: 40, required: 20, assigned: 10, missing: 10,
  days: [],
  shifts: [{ shiftId: 's1', name: 'Crew', startTime: '08:00', endTime: '17:00', days: [] }],
  ...over,
});

describe('JobsPanel headline hours', () => {
  it('shows assigned vs required this week as the headline figure', () => {
    render(<JobsPanel title="Jobs This Week" jobs={[summary()]} emptyLabel="none" allStaffedLabel="all" />);
    expect(screen.getByText('10 / 20h')).toBeInTheDocument();
    expect(screen.getByText('this week')).toBeInTheDocument();
  });

  it('no longer shows a standalone job total', () => {
    render(<JobsPanel title="Jobs This Week" jobs={[summary()]} emptyLabel="none" allStaffedLabel="all" />);
    expect(screen.queryByText('40h total')).not.toBeInTheDocument();
  });

  it('reflects assigned dropping to zero', () => {
    render(<JobsPanel title="Jobs This Week" jobs={[summary({ assigned: 0, missing: 20 })]} emptyLabel="none" allStaffedLabel="all" />);
    expect(screen.getByText('0 / 20h')).toBeInTheDocument();
  });

  it('mirrors assigned as the total when the job has no estimate', () => {
    render(<JobsPanel title="Jobs This Week" jobs={[summary({ estimate: 0, required: 0, assigned: 18, missing: 0 })]} emptyLabel="none" allStaffedLabel="all" />);
    expect(screen.getByText('18 / 18h')).toBeInTheDocument();
  });

  it('shows a staffed job as a clean met total, capping over-assignment', () => {
    render(<JobsPanel title="Jobs This Week" jobs={[summary({ estimate: 18, required: 9, assigned: 18, missing: 0 })]} emptyLabel="none" allStaffedLabel="all" />);
    expect(screen.getByText('9 / 9h')).toBeInTheDocument();
    expect(screen.queryByText('18 / 9h')).not.toBeInTheDocument();
  });
});

describe('JobsPanel period lens', () => {
  it('shows the month sublabel when period is month', () => {
    render(<JobsPanel title="Jobs This Month" period="month" jobs={[summary()]} emptyLabel="none" allStaffedLabel="all" />);
    expect(screen.getByText('this month')).toBeInTheDocument();
    expect(screen.queryByText('this week')).not.toBeInTheDocument();
  });

  it('renders the Week/Month/Year control and fires onPeriodChange', () => {
    const onPeriodChange = vi.fn();
    render(<JobsPanel title="Jobs This Week" period="week" onPeriodChange={onPeriodChange} jobs={[summary()]} emptyLabel="none" allStaffedLabel="all" />);
    fireEvent.click(screen.getByRole('button', { name: 'Month' }));
    expect(onPeriodChange).toHaveBeenCalledWith('month');
  });

  it('shows a collapsed day-range instead of day pills in month view', () => {
    render(<JobsPanel title="Jobs This Month" period="month" jobs={[summary({ days: ['2026-06-08','2026-06-09','2026-06-10'] })]} emptyLabel="none" allStaffedLabel="all" />);
    expect(screen.getByText(/3 days/)).toBeInTheDocument();
  });
});

describe('JobsPanel compact mode', () => {
  it('shows the headline hours in compact mode', () => {
    render(<JobsPanel title="Jobs This Week" compact onCompactChange={() => {}} jobs={[summary()]} emptyLabel="none" allStaffedLabel="all" />);
    expect(screen.getByText('10 / 20h')).toBeInTheDocument();
  });

  it('fires onCompactChange when the toggle is clicked', () => {
    const onCompactChange = vi.fn();
    render(<JobsPanel title="Jobs This Week" compact={false} onCompactChange={onCompactChange} jobs={[summary()]} emptyLabel="none" allStaffedLabel="all" />);
    fireEvent.click(screen.getByRole('button', { name: 'Compact view' }));
    expect(onCompactChange).toHaveBeenCalledWith(true);
  });
});

const dt = () => { const store: Record<string, string> = {}; return {
  setData: (k: string, v: string) => { store[k] = v; }, getData: (k: string) => store[k] ?? '',
  effectAllowed: '', get types() { return Object.keys(store); },
} as unknown as DataTransfer; };

describe('JobsPanel — shift cards', () => {
  const multi = summary({ jobId: 'j6', jobName: 'Downtown Commercial', shifts: [
    { shiftId: 'f', name: 'First Coat', startTime: '13:00', endTime: '15:00', days: ['2026-06-08'] },
    { shiftId: 's', name: 'Second Coat', startTime: '15:00', endTime: '17:00', days: ['2026-06-08'] },
  ]});

  it('multi-shift card is not draggable and expands to shift rows', () => {
    render(<JobsPanel title="T" jobs={[multi]} emptyLabel="e" allStaffedLabel="a" />);
    expect(screen.getByText('Downtown Commercial').closest('li')).not.toHaveAttribute('draggable', 'true');
    fireEvent.click(screen.getByRole('button', { name: /show shifts/i }));
    expect(screen.getByText('First Coat')).toBeInTheDocument();
    expect(screen.getByText('Second Coat')).toBeInTheDocument();
  });

  it('dragging a shift row sets both job and shift payloads', () => {
    render(<JobsPanel title="T" jobs={[multi]} emptyLabel="e" allStaffedLabel="a" />);
    fireEvent.click(screen.getByRole('button', { name: /show shifts/i }));
    const d = dt();
    fireEvent.dragStart(screen.getByText('First Coat').closest('[draggable="true"]')!, { dataTransfer: d });
    expect(d.getData('application/x-job-id')).toBe('j6');
    expect(d.getData('application/x-shift-id')).toBe('f');
  });

  it('a single-shift card stays draggable and carries its shift id', () => {
    const single = summary({ jobId: 'j1' }); // fixture default: one 'Crew' shift s1
    render(<JobsPanel title="T" jobs={[single]} emptyLabel="e" allStaffedLabel="a" />);
    const d = dt();
    fireEvent.dragStart(screen.getByText(single.jobName).closest('li')!, { dataTransfer: d });
    expect(d.getData('application/x-job-id')).toBe('j1');
    expect(d.getData('application/x-shift-id')).toBe('s1');
  });
});
