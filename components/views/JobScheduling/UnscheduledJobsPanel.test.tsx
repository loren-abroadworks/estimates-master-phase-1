import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UnscheduledJobsPanel, selectUnscheduledJobs, type UnscheduledJobCard } from './UnscheduledJobsPanel';
import type { Job } from '../../../types';

const job = (over: Partial<Job>): Job => ({
  id: 'j1', jobNumber: 'J-1', name: 'Exterior Repaint', stage: 'Confirmed',
  ...over,
} as Job);

describe('selectUnscheduledJobs', () => {
  it('returns only jobs with no startDate', () => {
    const jobs = [
      job({ id: 'a' }),
      job({ id: 'b', startDate: '2026-06-02T08:00:00' }),
    ];
    expect(selectUnscheduledJobs(jobs).map(j => j.id)).toEqual(['a']);
  });

  it('excludes Cancelled jobs even when they have no startDate', () => {
    const jobs = [
      job({ id: 'a' }),
      job({ id: 'c', stage: 'Cancelled' }),
    ];
    expect(selectUnscheduledJobs(jobs).map(j => j.id)).toEqual(['a']);
  });
});

const card = (over: Partial<UnscheduledJobCard> = {}): UnscheduledJobCard => ({
  job: job({ id: 'a', name: 'Smith Living Room', jobNumber: 'J-9' }),
  clientName: 'Smith',
  color: '#10b981',
  estHours: 16,
  ...over,
});

describe('UnscheduledJobsPanel', () => {
  it('renders a card with name, number, client, and hours hint', () => {
    render(<UnscheduledJobsPanel cards={[card()]} canReschedule onSelectJob={vi.fn()} />);
    expect(screen.getByText('Smith Living Room')).toBeInTheDocument();
    expect(screen.getByText('J-9 · Smith')).toBeInTheDocument();
    expect(screen.getByText('~16h est')).toBeInTheDocument();
  });

  it('sets the dragged job id on dragStart', () => {
    render(<UnscheduledJobsPanel cards={[card()]} canReschedule onSelectJob={vi.fn()} />);
    const setData = vi.fn();
    fireEvent.dragStart(screen.getByText('Smith Living Room').closest('li')!, {
      dataTransfer: { setData, effectAllowed: '' },
    });
    expect(setData).toHaveBeenCalledWith('application/x-job-id', 'a');
  });

  it('calls onSelectJob when a card is clicked', () => {
    const onSelectJob = vi.fn();
    render(<UnscheduledJobsPanel cards={[card()]} canReschedule onSelectJob={onSelectJob} />);
    fireEvent.click(screen.getByText('Smith Living Room').closest('li')!);
    expect(onSelectJob).toHaveBeenCalledWith('a');
  });

  it('is not draggable when canReschedule is false', () => {
    render(<UnscheduledJobsPanel cards={[card()]} canReschedule={false} onSelectJob={vi.fn()} />);
    const li = screen.getByText('Smith Living Room').closest('li')!;
    expect(li.getAttribute('draggable')).not.toBe('true');
  });

  it('shows the empty state when there are no cards', () => {
    render(<UnscheduledJobsPanel cards={[]} canReschedule onSelectJob={vi.fn()} />);
    expect(screen.getByText('All jobs are scheduled.')).toBeInTheDocument();
  });
});
