import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { CrewTransferPicker } from './CrewTransferPicker';
import type { CrewMember } from '../../types';

const staff: CrewMember[] = [
  { id: 'm1', name: 'Mike Smith', role: 'Owner' },
  { id: 'm2', name: 'Jessica Miller', role: 'Estimator' },
  { id: 'm3', name: 'David Chen', role: 'Painter' },
];

const baseProps = {
  allStaff: staff,
  leaderId: null as string | null,
  weekDays: [] as Date[],
  existingJobs: [],
  weekendDays: [0, 6],
  standardDay: 8,
  onAdd: vi.fn(),
  onRemove: vi.fn(),
  onSetLeader: vi.fn(),
  onDone: vi.fn(),
  onCancel: vi.fn(),
};

describe('CrewTransferPicker', () => {
  it('lists un-added staff on the left and added staff on the right', () => {
    render(<CrewTransferPicker {...baseProps} selectedIds={['m1']} />);
    const available = screen.getByRole('region', { name: 'Available' });
    const added = screen.getByRole('region', { name: 'Added' });
    expect(within(available).getByText('Jessica Miller')).toBeInTheDocument();
    expect(within(available).getByText('David Chen')).toBeInTheDocument();
    expect(within(available).queryByText('Mike Smith')).toBeNull();
    expect(within(added).getByText('Mike Smith')).toBeInTheDocument();
  });

  it('counts the shift being edited, so its figure matches the grid’s weekly column', () => {
    // Mon Jun 8 – Sun Jun 14 2026, with 8h owed to another job and 13h drafted here.
    const weekDays = Array.from({ length: 7 }, (_, i) => new Date(2026, 5, 8 + i, 12));
    const other = [{
      id: 'j9', name: 'Other job',
      allocations: [{
        id: 'a9', name: 'Crew', memberIds: ['m1'],
        startDate: '2026-06-08', endDate: '2026-06-08',
        hoursAssignments: { m1: { '2026-06-08': 8 } },
      }],
    }] as any;
    render(
      <CrewTransferPicker
        {...baseProps}
        selectedIds={['m1']}
        weekDays={weekDays}
        existingJobs={other}
        hoursAssignments={{ m1: { '2026-06-09': 8, '2026-06-10': 5 } }}
      />,
    );
    const added = screen.getByRole('region', { name: 'Added' });
    expect(within(added).getByText('21')).toBeInTheDocument();
    expect(within(added).getByText('/40h')).toBeInTheDocument();
    expect(within(added).getByText('19h left')).toBeInTheDocument();
  });

  it('does not double count the saved copy of the shift being edited', () => {
    const weekDays = Array.from({ length: 7 }, (_, i) => new Date(2026, 5, 8 + i, 12));
    const thisJob = [{
      id: 'j1', name: 'This job',
      allocations: [{
        id: 'shift-1', name: 'Crew', memberIds: ['m1'],
        startDate: '2026-06-09', endDate: '2026-06-09',
        hoursAssignments: { m1: { '2026-06-09': 8 } },
      }],
    }] as any;
    render(
      <CrewTransferPicker
        {...baseProps}
        selectedIds={['m1']}
        weekDays={weekDays}
        existingJobs={thisJob}
        excludeAllocationId="shift-1"
        hoursAssignments={{ m1: { '2026-06-09': 6 } }}
      />,
    );
    const added = screen.getByRole('region', { name: 'Added' });
    expect(within(added).getByText('6')).toBeInTheDocument(); // the draft only, not 6 + 8
  });

  it('calls onAdd with the member id when Add is clicked', () => {
    const onAdd = vi.fn();
    render(<CrewTransferPicker {...baseProps} selectedIds={[]} onAdd={onAdd} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add Jessica Miller' }));
    expect(onAdd).toHaveBeenCalledWith('m2');
  });

  it('calls onRemove with the member id when Remove is clicked', () => {
    const onRemove = vi.fn();
    render(<CrewTransferPicker {...baseProps} selectedIds={['m1']} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Mike Smith' }));
    expect(onRemove).toHaveBeenCalledWith('m1');
  });

  it('calls onSetLeader when the crown is clicked', () => {
    const onSetLeader = vi.fn();
    render(<CrewTransferPicker {...baseProps} selectedIds={['m1']} onSetLeader={onSetLeader} />);
    fireEvent.click(screen.getByRole('button', { name: 'Make leader Mike Smith' }));
    expect(onSetLeader).toHaveBeenCalledWith('m1');
  });

  it('filters the available panel by the search box', () => {
    render(<CrewTransferPicker {...baseProps} selectedIds={[]} />);
    fireEvent.change(screen.getByPlaceholderText('Search to add crew member...'), { target: { value: 'jess' } });
    const available = screen.getByRole('region', { name: 'Available' });
    expect(within(available).getByText('Jessica Miller')).toBeInTheDocument();
    expect(within(available).queryByText('Mike Smith')).toBeNull();
  });

  it('shows an empty state when no crew is added', () => {
    render(<CrewTransferPicker {...baseProps} selectedIds={[]} />);
    expect(screen.getByText('No crew added yet.')).toBeInTheDocument();
  });

  it('calls onDone when Done is clicked', () => {
    const onDone = vi.fn();
    render(<CrewTransferPicker {...baseProps} selectedIds={[]} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('CrewTransferPicker — leaving the panel', () => {
  it('reports Cancel separately from Add, so the caller can discard the picks', () => {
    const onDone = vi.fn();
    const onCancel = vi.fn();
    render(<CrewTransferPicker {...baseProps} selectedIds={['m1']} onDone={onDone} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });
});
