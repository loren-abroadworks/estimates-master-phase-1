import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonthBoard } from './MonthBoard';
import { buildMonthWeeks } from '../../../services/monthBoard';
import { configFromSettings } from '../../../services/scheduleEngine';
import type { Job } from '../../../types';

const cfg = configFromSettings(undefined, false);
const weeks = buildMonthWeeks(new Date(2026, 5, 15), cfg);

const job = (over: Partial<Job>): Job => ({
  id: 'j1', jobNumber: 'J-1', name: 'Exterior Repaint', stage: 'Scheduled',
  startDate: '2026-06-02T08:00:00', endDate: '2026-06-04T17:00:00', ...over,
} as Job);

const base = {
  weeks, jobs: [job({})], config: cfg, colorForJob: () => '#3b82f6',
  canReschedule: true, onSelectJob: vi.fn(), onDropJob: vi.fn(),
};

describe('MonthBoard', () => {
  it('renders weekday headers and day-number cells', () => {
    render(<MonthBoard {...base} />);
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0); // Jun 1 cell
  });

  it('renders a spanning bar for a multi-day job', () => {
    render(<MonthBoard {...base} />);
    expect(screen.getByText('Exterior Repaint')).toBeInTheDocument();
  });

  it('calls onSelectJob when a job bar is clicked', () => {
    render(<MonthBoard {...base} />);
    fireEvent.click(screen.getByText('Exterior Repaint'));
    expect(base.onSelectJob).toHaveBeenCalledWith('j1');
  });

  it('calls onDropJob with the id from dataTransfer when an external card is dropped', () => {
    const onDropJob = vi.fn();
    render(<MonthBoard {...base} jobs={[]} onDropJob={onDropJob} />);
    // Jun 15, 2026 is in-month and its day number is unique in the grid
    // (unlike '1', which spill days from adjacent months also render).
    const cell = screen.getByText('15').closest('div')!.parentElement!;
    fireEvent.drop(cell, { dataTransfer: { getData: () => 'job-42' } });
    expect(onDropJob).toHaveBeenCalled();
    expect(onDropJob.mock.calls[0][0]).toBe('job-42');
  });

  const shiftJob = {
    id: 'sj', jobNumber: 'S-1', name: 'Cascade Test', stage: 'Scheduled', clientId: 'c1',
    startDate: '2026-06-02T08:00:00', endDate: '2026-06-03T17:00:00', dateCreated: '2026-01-01',
    allocations: [
      { id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-06-02', endDate: '2026-06-02', startTime: '08:00', endTime: '12:00' },
      { id: 's2', name: 'Finish', memberIds: ['m1'], startDate: '2026-06-03', endDate: '2026-06-03', startTime: '08:00', endTime: '12:00' },
    ],
  } as unknown as Job;

  it('renders one bar per shift, labelled job-first with the shift appended', () => {
    render(<MonthBoard {...base} jobs={[shiftJob]} />);
    expect(screen.getByText('Cascade Test · Prep')).toBeInTheDocument();
    expect(screen.getByText('Cascade Test · Finish')).toBeInTheDocument();
  });

  it("a single-shift job's bar shows just the job name", () => {
    const solo = { ...shiftJob, id: 'solo', name: 'Solo Job', allocations: [shiftJob.allocations![0]] } as Job;
    render(<MonthBoard {...base} jobs={[solo]} />);
    expect(screen.getByText('Solo Job')).toBeInTheDocument();
  });

  it('drops carry the dragged bar’s shift id to onDropJob', () => {
    const onDropJob = vi.fn();
    render(<MonthBoard {...base} jobs={[shiftJob]} onDropJob={onDropJob} />);
    fireEvent.dragStart(screen.getByText('Cascade Test · Prep'), { dataTransfer: { setData: vi.fn() } });
    const cell = screen.getByText('15').closest('div')!.parentElement!;
    fireEvent.drop(cell, { dataTransfer: { getData: () => '' } });
    expect(onDropJob).toHaveBeenCalledWith('sj', expect.any(String), 's1');
  });
});
