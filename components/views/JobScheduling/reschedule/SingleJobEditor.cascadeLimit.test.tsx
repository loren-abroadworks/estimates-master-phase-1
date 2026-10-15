import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SingleJobEditor } from './SingleJobEditor';
import type { ProposedChange } from '../../../../services/scheduleEngine';

const change: ProposedChange = {
  jobId: 'j1', jobName: 'Job 1', jobNumber: 'J-1',
  oldStart: '2026-06-02T08:00:00', oldEnd: '2026-06-02T17:00:00',
  newStart: '2026-06-04T08:00:00', newEnd: '2026-06-04T17:00:00',
};

const baseProps = {
  change, issues: [], suggestions: [], onAutoFix: () => {}, crew: [], dayHours: {},
  onChangeJobDate: () => {}, onToggleCascade: () => {},
};

describe('SingleJobEditor cascade end-date limit', () => {
  it('shows the cutoff control only when cascade is on', () => {
    const { rerender } = render(<SingleJobEditor {...baseProps} cascade={false} />);
    expect(screen.queryByText(/stop cascade after/i)).toBeNull();
    rerender(<SingleJobEditor {...baseProps} cascade={true} />);
    expect(screen.getByText(/stop cascade after/i)).toBeInTheDocument();
  });

  it('reports the protected count when jobs fall after the cutoff', () => {
    const protectedJobs: ProposedChange[] = [
      { ...change, jobId: 'j3', jobName: 'Job 3', skipped: 'after-limit' },
    ];
    render(<SingleJobEditor {...baseProps} cascade={true} cascadeUntil="2026-06-05" protectedJobs={protectedJobs} />);
    expect(screen.getByText(/1 job after .* left unchanged/i)).toBeInTheDocument();
  });

  it('warns when a moved follower leapfrogs a protected job', () => {
    render(<SingleJobEditor {...baseProps} cascade={true} cascadeUntil="2026-06-05" leapfrogJobNames={['Job 2']} />);
    expect(screen.getByText(/lands after a protected job/i)).toBeInTheDocument();
  });

  it('clears the cutoff via the Clear button', async () => {
    const onChangeCascadeUntil = vi.fn();
    render(<SingleJobEditor {...baseProps} cascade={true} cascadeUntil="2026-06-05" onChangeCascadeUntil={onChangeCascadeUntil} />);
    await userEvent.click(screen.getByRole('button', { name: /clear cascade cutoff/i }));
    expect(onChangeCascadeUntil).toHaveBeenCalledWith('');
  });
});
