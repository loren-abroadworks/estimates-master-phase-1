import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkPreview } from './BulkPreview';
import type { ProposedChange } from '../../../../services/scheduleEngine';
import type { RescheduleImpact } from '../../../../services/rescheduleImpact';

const mk = (id: string, name: string): ProposedChange => ({
  jobId: id, jobName: name, jobNumber: id,
  oldStart: '2026-06-02T08:00:00', oldEnd: '2026-06-02T17:00:00',
  newStart: '2026-06-04T08:00:00', newEnd: '2026-06-04T17:00:00',
});

const impact: RescheduleImpact = {
  jobsAffected: 2, crewsAffected: 1, totalDelayDays: 2, affectedJobNames: ['A', 'B'],
  affectedCrewNames: ['Crew 1'], newEndDate: '2026-06-06T17:00:00', lockedCount: 0,
  weatherHits: [], customerUpdates: [],
};

const base = {
  changes: [mk('a', 'Repaint Deck'), mk('b', 'Trim Work')],
  issues: [], suggestions: [], impact, onAutoFix: vi.fn(),
};

describe('BulkPreview', () => {
  it('renders the four impact tiles', () => {
    render(<BulkPreview {...base} />);
    expect(screen.getByText('Jobs Affected')).toBeInTheDocument();
    expect(screen.getByText('Crews Affected')).toBeInTheDocument();
  });

  it('lists each affected job', () => {
    render(<BulkPreview {...base} />);
    expect(screen.getAllByText('Repaint Deck').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Trim Work').length).toBeGreaterThan(0);
  });

  it('shows the Delay-by control and fires onChangeDelay when recompute is given', () => {
    const onChangeDelay = vi.fn();
    render(<BulkPreview {...base} delayDays={2} onChangeDelay={onChangeDelay} />);
    expect(screen.getByText('Delay by')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '5' } });
    expect(onChangeDelay).toHaveBeenCalledWith(5);
  });

  it('hides the Delay-by control when onChangeDelay is absent', () => {
    render(<BulkPreview {...base} />);
    expect(screen.queryByText('Delay by')).not.toBeInTheDocument();
  });

  it('shows customer update notifications (Preview Messages) but not the Auto-Fix Fix-For-Me button', () => {
    const withCustomers = { ...impact, customerUpdates: [
      { clientId: 'cl1', clientName: 'Acme Co', jobName: 'Repaint Deck', oldStart: '2026-06-02T08:00:00', newStart: '2026-06-04T08:00:00' },
    ] };
    render(<BulkPreview {...base} impact={withCustomers} />);
    expect(screen.getByText('Preview Messages')).toBeInTheDocument();
    expect(screen.queryByText('Fix For Me')).not.toBeInTheDocument();
  });
});

describe('BulkPreview — elapsed days are called out', () => {
  it('says how many worked days a change will keep in place', () => {
    const withPinned: ProposedChange = { ...mk('a', 'Repaint Deck'), pinnedDays: ['2026-08-17', '2026-08-18'] };
    render(<BulkPreview {...base} changes={[withPinned]} />);
    expect(screen.getByText(/keeps 2 worked day/i)).toBeInTheDocument();
  });

  it('says nothing when no day has elapsed', () => {
    render(<BulkPreview {...base} />);
    expect(screen.queryByText(/worked day/i)).not.toBeInTheDocument();
  });
});
