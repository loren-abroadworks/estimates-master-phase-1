import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayBoard } from './DayBoard';
import { buildJobLanes } from '../../../services/productionBoard';
import { configFromSettings } from '../../../services/scheduleEngine';
import type { Job } from '../../../types';

const cfg = configFromSettings(undefined, false);
const DAY = '2026-06-10';

const job = (over: Partial<Job> = {}): Job =>
  ({ id: 'j1', jobNumber: 'J-1', name: 'Repaint', stage: 'Scheduled', clientId: 'c1',
     startDate: '2026-06-10T10:00:00', endDate: '2026-06-10T14:00:00', ...over } as Job);

const lanesFor = (jobs: Job[]) => buildJobLanes(jobs, [new Date('2026-06-10T12:00:00')], cfg);

const base = {
  dayKey: DAY,
  config: cfg,
  canReschedule: true,
  renderRowLabel: undefined,
  onViewJob: vi.fn(),
  onChangeDayWindow: vi.fn(),
  onMarkRainDay: vi.fn(),
  rainDays: [] as { date: string }[],
};

describe('DayBoard', () => {
  it('renders a full 24-hour axis of hour labels', () => {
    render(<DayBoard {...base} lanes={lanesFor([job()])} />);
    expect(screen.getAllByText('12:00 AM').length).toBeGreaterThan(0); // midnight
    expect(screen.getAllByText('8:00 AM').length).toBeGreaterThan(0);
    expect(screen.getAllByText('11:00 PM').length).toBeGreaterThan(0);
  });

  it('renders a block for each job in the day', () => {
    const { container } = render(<DayBoard {...base} lanes={lanesFor([job()])} />);
    expect(container.querySelector('[data-job-id="j1"]')).toBeInTheDocument();
  });

  it('opens details when a block is clicked', () => {
    const onViewJob = vi.fn();
    const { container } = render(<DayBoard {...base} onViewJob={onViewJob} lanes={lanesFor([job()])} />);
    fireEvent.click(container.querySelector('[data-job-id="j1"]') as HTMLElement);
    expect(onViewJob).toHaveBeenCalledWith('j1');
  });
});

describe('DayBoard shift-aware blocks', () => {
  const twoShiftJob = job({
    allocations: [
      { id: 's1', name: 'Prep', memberIds: ['m1'], startDate: '2026-06-10', endDate: '2026-06-10', startTime: '08:00', endTime: '12:00' },
      { id: 's2', name: 'Finish', memberIds: ['m1'], startDate: '2026-06-10', endDate: '2026-06-10', startTime: '13:00', endTime: '17:00' },
    ],
  });

  it('renders one block per shift with a shift id', () => {
    const { container } = render(<DayBoard {...base} lanes={lanesFor([twoShiftJob])} />);
    expect(container.querySelector('[data-shift-id="s1"]')).toBeInTheDocument();
    expect(container.querySelector('[data-shift-id="s2"]')).toBeInTheDocument();
  });

  it('passes the shift id to blockHours', () => {
    const blockHours = vi.fn(() => ({ hours: 4, editable: true }));
    render(<DayBoard {...base} lanes={lanesFor([twoShiftJob])} blockHours={blockHours} onEditBlockHours={vi.fn()} onRemoveBlockHours={vi.fn()} />);
    expect(blockHours).toHaveBeenCalledWith('j1', 'j1', 's1');
    expect(blockHours).toHaveBeenCalledWith('j1', 'j1', 's2');
  });

  it('block drag passes the shift id to onChangeDayWindow', () => {
    const onChangeDayWindow = vi.fn();
    const { container } = render(<DayBoard {...base} onChangeDayWindow={onChangeDayWindow} lanes={lanesFor([twoShiftJob])} />);
    const block = container.querySelector('[data-shift-id="s1"]') as HTMLElement;
    fireEvent.pointerDown(block, { button: 0, clientY: 100 });
    fireEvent.pointerMove(window, { clientY: 120 }); // marks moved
    fireEvent.pointerUp(window, { clientY: 120 });
    expect(onChangeDayWindow).toHaveBeenCalledWith('j1', DAY, expect.any(Object), 's1');
  });
});

describe('DayBoard drag guards', () => {
  it('marks blocks non-draggable in read-only mode', () => {
    const { container } = render(<DayBoard {...base} canReschedule={false} lanes={lanesFor([job()])} />);
    const block = container.querySelector('[data-job-id="j1"]') as HTMLElement;
    expect(block.dataset.draggable).toBe('false');
  });

  it('marks a locked job non-draggable', () => {
    const locked = job({ is_locked: true });
    const { container } = render(<DayBoard {...base} lanes={lanesFor([locked])} />);
    const block = container.querySelector('[data-job-id="j1"]') as HTMLElement;
    expect(block.dataset.draggable).toBe('false');
  });
});

describe('DayBoard — break splitting', () => {
  const lunch = { id: 'b1', label: 'Lunch', durationMinutes: 30, paid: false, startTime: '12:00' };

  it('splits a job into two segments around a fixed break', () => {
    const j = job({ startDate: '2026-06-10T10:00:00', endDate: '2026-06-10T14:00:00' });
    const { container } = render(
      <DayBoard {...base} lanes={lanesFor([j])} laneBreaks={() => [lunch]} />,
    );
    expect(container.querySelectorAll('[data-job-id="j1"]').length).toBe(2);
  });

  it('renders a single segment when no break overlaps the job', () => {
    const j = job({ startDate: '2026-06-10T10:00:00', endDate: '2026-06-10T11:30:00' }); // ends before lunch
    const { container } = render(
      <DayBoard {...base} lanes={lanesFor([j])} laneBreaks={() => [lunch]} />,
    );
    expect(container.querySelectorAll('[data-job-id="j1"]').length).toBe(1);
  });

  it('still opens the job when a segment is clicked', () => {
    const onViewJob = vi.fn();
    const j = job({ startDate: '2026-06-10T10:00:00', endDate: '2026-06-10T14:00:00' });
    const { container } = render(
      <DayBoard {...base} onViewJob={onViewJob} lanes={lanesFor([j])} laneBreaks={() => [lunch]} />,
    );
    fireEvent.click(container.querySelectorAll('[data-job-id="j1"]')[1] as HTMLElement);
    expect(onViewJob).toHaveBeenCalledWith('j1');
  });
});
