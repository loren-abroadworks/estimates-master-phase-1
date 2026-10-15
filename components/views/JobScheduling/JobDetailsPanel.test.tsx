import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { JobDetailsPanel, cancelJobPatch, crewSummary, jobActualSchedule, jobDailySchedule, jobShiftSpan } from './JobDetailsPanel';
import type { Job, Client, CrewMember } from '../../../types';

const job: Job = {
  id: 'j1', jobNumber: 'J-1', name: 'Kitchen Repaint', clientId: 'cl1',
  estimateId: 'e1', address: '482 Oak St', stage: 'Scheduled',
  startDate: '2026-06-08T08:00:00', endDate: '2026-06-10T17:00:00',
  crewMemberIds: ['m1', 'm2'], dateCreated: '2026-06-01T00:00:00',
};
const client: Client = {
  id: 'cl1', name: 'Jane Doe', email: 'j@x.com', phone: '555-1234',
  address: '482 Oak St', properties: [],
};
const staff: CrewMember[] = [
  { id: 'm1', name: 'Mike', role: 'Painter' },
  { id: 'm2', name: 'Sara', role: 'Lead' },
];

describe('cancelJobPatch', () => {
  it('sets stage to Cancelled and clears both dates', () => {
    const patched = cancelJobPatch(job);
    expect(patched.stage).toBe('Cancelled');
    expect(patched.startDate).toBeUndefined();
    expect(patched.endDate).toBeUndefined();
    expect(patched.id).toBe('j1'); // rest preserved
  });
});

describe('crewSummary', () => {
  it('counts and names members from crewMemberIds', () => {
    const s = crewSummary(job, staff);
    expect(s.count).toBe(2);
    expect(s.names).toEqual(['Mike', 'Sara']);
  });
  it('handles no crew', () => {
    const s = crewSummary({ ...job, crewMemberIds: [] }, staff);
    expect(s.count).toBe(0);
    expect(s.names).toEqual([]);
  });
  it('count matches resolved names when an id is stale/unknown', () => {
    const s = crewSummary({ ...job, crewMemberIds: ['m1', 'ghost'] }, staff);
    expect(s.count).toBe(1);
    expect(s.names).toEqual(['Mike']);
  });
});

describe('jobShiftSpan', () => {
  it('spans the earliest shift start to the latest shift end', () => {
    const withShifts: Job = {
      ...job,
      startDate: '2026-06-08T08:00:00',
      endDate: '2026-06-08T17:00:00', // stale job envelope — one day only
      allocations: [
        { id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-06-08', endDate: '2026-06-08', startTime: '08:00', endTime: '12:00' },
        { id: 's2', name: 'Paint', memberIds: ['m2'], startDate: '2026-06-08', endDate: '2026-06-11', startTime: '13:00', endTime: '17:00' },
      ],
    };
    expect(jobShiftSpan(withShifts)).toEqual({ start: '2026-06-08', end: '2026-06-11' });
  });

  it('falls back to the job envelope when there are no allocations', () => {
    expect(jobShiftSpan(job)).toEqual({ start: '2026-06-08T08:00:00', end: '2026-06-10T17:00:00' });
  });
});

describe('jobDailySchedule', () => {
  it('lists one entry per calendar day, defaulting to the job start/end clock', () => {
    // Jun 8 08:00 → Jun 10 17:00, no per-day overrides.
    const sched = jobDailySchedule(job);
    expect(sched.map(d => d.dateKey)).toEqual(['2026-06-08', '2026-06-09', '2026-06-10']);
    expect(sched.every(d => d.startTime === '08:00' && d.endTime === '17:00')).toBe(true);
  });

  it('honors per-day dailyHours overrides', () => {
    const withOverride = { ...job, dailyHours: { '2026-06-09': { startTime: '10:00', endTime: '14:30' } } };
    const wed = jobDailySchedule(withOverride).find(d => d.dateKey === '2026-06-09')!;
    expect(wed.startTime).toBe('10:00');
    expect(wed.endTime).toBe('14:30');
  });

  it('returns an empty list for an unscheduled job', () => {
    expect(jobDailySchedule({ ...job, startDate: undefined, endDate: undefined })).toEqual([]);
  });
});

describe('JobDetailsPanel', () => {
  const noop = () => {};
  const base = {
    client, allStaff: staff,
    onClose: noop, onReschedule: noop,
    onCancel: noop, onViewFullDetails: noop,
  };

  it('renders nothing when job is null', () => {
    const { container } = render(<JobDetailsPanel job={null} {...base} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows job name, number, customer and address', () => {
    render(<JobDetailsPanel job={job} {...base} />);
    expect(screen.getByText('Kitchen Repaint')).toBeTruthy();
    expect(screen.getByText(/J-1/)).toBeTruthy();
    expect(screen.getByText(/Jane Doe/)).toBeTruthy();
    expect(screen.getByText(/482 Oak St/)).toBeTruthy();
  });

  it('shows the schedule section with shift-derived start/end rows', () => {
    render(<JobDetailsPanel job={job} {...base} />);
    expect(screen.getByText('Schedule')).toBeTruthy();
    expect(screen.getAllByText('Start Date').length).toBe(1);
    expect(screen.getAllByText('End Date').length).toBe(1);
    // Dates come from the job's shift envelope (no allocations → job's own dates).
    expect(screen.getByText(/Jun 8, 2026/)).toBeTruthy();
    expect(screen.getByText(/Jun 10, 2026/)).toBeTruthy();
  });

  it('shows "Not scheduled" for the end date when the job is unscheduled', () => {
    const unscheduled = { ...job, startDate: undefined, endDate: undefined };
    render(<JobDetailsPanel job={unscheduled} {...base} />);
    expect(screen.getAllByText('Not scheduled').length).toBeGreaterThanOrEqual(2);
  });

  it('shows the per-day start and end times in 12-hour format', () => {
    const withOverride = { ...job, dailyHours: { '2026-06-09': { startTime: '10:00', endTime: '14:30' } } };
    render(<JobDetailsPanel job={withOverride} {...base} />);
    // Default-window days render the job's 8–5 clock; the overridden day renders its own window.
    expect(screen.getAllByText(/8:00 AM\s*–\s*5:00 PM/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/10:00 AM\s*–\s*2:30 PM/)).toBeTruthy();
  });

  it('labels the action "View shifts" for a scheduled job', () => {
    render(<JobDetailsPanel job={job} {...base} />);
    expect(screen.getByText('View shifts')).toBeTruthy();
    expect(screen.queryByText('Schedule job')).toBeNull();
  });

  it('labels the action "Schedule job" for a job with no start date', () => {
    const unscheduled = { ...job, startDate: undefined, endDate: undefined };
    render(<JobDetailsPanel job={unscheduled} {...base} />);
    expect(screen.getByText('Schedule job')).toBeTruthy();
    expect(screen.queryByText('Reschedule job')).toBeNull();
  });

  it('fires the right callbacks for each action', () => {
    const onReschedule = vi.fn();
    const onCancel = vi.fn();
    const onViewFullDetails = vi.fn();
    render(
      <JobDetailsPanel
        job={job} {...base}
        onReschedule={onReschedule}
        onCancel={onCancel} onViewFullDetails={onViewFullDetails}
      />,
    );
    fireEvent.click(screen.getByText('View shifts'));
    fireEvent.click(screen.getByText('Cancel job'));
    fireEvent.click(screen.getByText(/View full details/));
    expect(onReschedule).toHaveBeenCalledWith('j1');
    expect(onCancel).toHaveBeenCalledWith('j1');
    expect(onViewFullDetails).toHaveBeenCalledWith('j1');
  });
});

describe('jobActualSchedule', () => {
  const oneShift: Job = {
    ...job,
    // Envelope anchored at noon (as the panel used to do) must not leak into the hours.
    startDate: '2026-06-08T12:00:00', endDate: '2026-06-08T12:00:00',
    allocations: [
      { id: 's1', name: 'Crew', memberIds: [], startDate: '2026-06-08', endDate: '2026-06-08', startTime: '08:00', endTime: '17:00' },
    ],
  };

  it('takes each day window from the shifts, not the job envelope clock', () => {
    expect(jobActualSchedule(oneShift)).toEqual([
      expect.objectContaining({ dateKey: '2026-06-08', startTime: '08:00', endTime: '17:00' }),
    ]);
  });

  it('unions overlapping shifts on a day: earliest start, latest end', () => {
    const two: Job = {
      ...oneShift,
      allocations: [
        { id: 's1', name: 'Prep', memberIds: [], startDate: '2026-06-08', endDate: '2026-06-08', startTime: '09:00', endTime: '12:00' },
        { id: 's2', name: 'Paint', memberIds: [], startDate: '2026-06-08', endDate: '2026-06-09', startTime: '07:30', endTime: '16:00' },
      ],
    };
    const sched = jobActualSchedule(two);
    expect(sched.map(d => [d.dateKey, d.startTime, d.endTime])).toEqual([
      ['2026-06-08', '07:30', '16:00'],
      ['2026-06-09', '07:30', '16:00'],
    ]);
  });

  it('honors a shift per-day override', () => {
    const withOverride: Job = {
      ...oneShift,
      allocations: [{ ...oneShift.allocations![0], endDate: '2026-06-09', dailyHours: { '2026-06-09': { startTime: '10:00', endTime: '14:30' } } }],
    };
    const fri = jobActualSchedule(withOverride).find(d => d.dateKey === '2026-06-09')!;
    expect([fri.startTime, fri.endTime]).toEqual(['10:00', '14:30']);
  });

  it('skips days no shift covers', () => {
    const gapped: Job = {
      ...oneShift,
      allocations: [
        { id: 's1', name: 'A', memberIds: [], startDate: '2026-06-08', endDate: '2026-06-08', startTime: '08:00', endTime: '12:00' },
        { id: 's2', name: 'B', memberIds: [], startDate: '2026-06-10', endDate: '2026-06-10', startTime: '13:00', endTime: '17:00' },
      ],
    };
    expect(jobActualSchedule(gapped).map(d => d.dateKey)).toEqual(['2026-06-08', '2026-06-10']);
  });

  it('falls back to the job envelope when there are no dated shifts', () => {
    expect(jobActualSchedule({ ...job, allocations: [] })).toEqual(jobDailySchedule(job));
  });

  it('omits days the shift skips', () => {
    const skipping: Job = {
      ...job,
      startDate: '2026-06-08T12:00:00', endDate: '2026-06-10T12:00:00',
      allocations: [{
        id: 's1', name: 'Crew', memberIds: [],
        startDate: '2026-06-08', endDate: '2026-06-10',
        startTime: '08:00', endTime: '17:00',
        skipDays: ['2026-06-09'],
      }],
    };
    expect(jobActualSchedule(skipping).map(d => d.dateKey)).toEqual(['2026-06-08', '2026-06-10']);
  });
});
