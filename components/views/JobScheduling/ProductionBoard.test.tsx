import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductionBoard } from './ProductionBoard';
import type { BoardLane } from '../../../services/productionBoard';
import { configFromSettings } from '../../../services/scheduleEngine';

const config = configFromSettings(undefined, false);
const week = [new Date('2026-06-01T12:00:00')];
const lanes: BoardLane[] = [{ crewId: 'm1', crewName: 'Alice', cardsByDay: {} }];

describe('ProductionBoard hooks', () => {
  it('fires onCellActivate when a cell background is clicked', () => {
    const onCellActivate = vi.fn();
    render(<ProductionBoard lanes={lanes} weekDays={week} config={config} canReschedule={false} onDropJob={vi.fn()} onCellActivate={onCellActivate} />);
    const cell = document.querySelector('[data-cell-id="m1:2026-06-01"]') as HTMLElement;
    fireEvent.click(cell);
    expect(onCellActivate).toHaveBeenCalledWith('m1', '2026-06-01');
  });

  it('fires onDropJob when a job is dropped on a day cell via dataTransfer', () => {
    const onDropJob = vi.fn();
    render(<ProductionBoard lanes={lanes} weekDays={week} config={config} canReschedule onDropJob={onDropJob} />);
    const cell = document.querySelector('[data-cell-id="m1:2026-06-01"]') as HTMLElement;
    fireEvent.drop(cell, { dataTransfer: { getData: () => 'job-7' } });
    expect(onDropJob).toHaveBeenCalledWith('job-7', '2026-06-01');
  });

  it('does not fire onDropJob on drop when canReschedule is false', () => {
    const onDropJob = vi.fn();
    render(<ProductionBoard lanes={lanes} weekDays={week} config={config} canReschedule={false} onDropJob={onDropJob} />);
    const cell = document.querySelector('[data-cell-id="m1:2026-06-01"]') as HTMLElement;
    fireEvent.drop(cell, { dataTransfer: { getData: () => 'job-7' } });
    expect(onDropJob).not.toHaveBeenCalled();
  });

  it('shows non-working days as columns but never accepts a drop on them', () => {
    const onDropJob = vi.fn();
    // Sat Jun 6 + Mon Jun 8 — the weekend column renders, but is inert as a target.
    const days = [new Date('2026-06-06T12:00:00'), new Date('2026-06-08T12:00:00')];
    const lanes: BoardLane[] = [{ crewId: 'm1', crewName: 'Alice', cardsByDay: {} }];
    render(<ProductionBoard lanes={lanes} weekDays={days} config={config} canReschedule onDropJob={onDropJob} />);

    const sat = document.querySelector('[data-cell-id="m1:2026-06-06"]') as HTMLElement;
    expect(sat).toBeTruthy(); // the column exists on the board
    fireEvent.drop(sat, { dataTransfer: { getData: () => 'job-7' } });
    expect(onDropJob).not.toHaveBeenCalled();

    const mon = document.querySelector('[data-cell-id="m1:2026-06-08"]') as HTMLElement;
    fireEvent.drop(mon, { dataTransfer: { getData: () => 'job-7' } });
    expect(onDropJob).toHaveBeenCalledWith('job-7', '2026-06-08');
  });

  it('renders a multi-day job as a single spanning bar with a duration badge', () => {
    const card = { jobId: 'a', jobName: 'Johnson Exterior', jobNumber: 'J1', color: '#3b82f6', startKey: '2026-06-01', endKey: '2026-06-03', isLocked: false, startTime: '08:00', endTime: '17:00' };
    const span3: BoardLane[] = [{ crewId: 'c', crewName: 'Crew A', cardsByDay: {
      '2026-06-01': [card], '2026-06-02': [card], '2026-06-03': [card],
    } }];
    const days = ['2026-06-01','2026-06-02','2026-06-03'].map(k => new Date(`${k}T12:00:00`));
    render(<ProductionBoard lanes={span3} weekDays={days} config={config} canReschedule={false} onDropJob={vi.fn()} />);
    expect(screen.getAllByText('Johnson Exterior')).toHaveLength(1);
    expect(screen.getByText('3d')).toBeInTheDocument();
  });

  it('renders one bar per shift for a multi-shift job (same job, distinct shifts)', () => {
    const prep = { jobId: 'a', jobName: 'Repaint', jobNumber: 'J1', color: '#3b82f6', startKey: '2026-06-01', endKey: '2026-06-01', isLocked: false, startTime: '08:00', endTime: '12:00', shiftId: 's1', shiftName: 'Prep' };
    const finish = { jobId: 'a', jobName: 'Repaint', jobNumber: 'J1', color: '#f97316', startKey: '2026-06-02', endKey: '2026-06-02', isLocked: false, startTime: '13:00', endTime: '17:00', shiftId: 's2', shiftName: 'Finish' };
    const jobLane: BoardLane[] = [{ crewId: 'a', crewName: 'Repaint', cardsByDay: {
      '2026-06-01': [prep], '2026-06-02': [finish],
    } }];
    const days = ['2026-06-01','2026-06-02'].map(k => new Date(`${k}T12:00:00`));
    render(<ProductionBoard lanes={jobLane} weekDays={days} config={config} canReschedule={false} onDropJob={vi.fn()} />);
    expect(screen.getByText('Prep', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Finish', { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText('Repaint')).toHaveLength(2);
  });

  it('renders a job in pendingIds as a faded dashed placeholder', () => {
    const card = { jobId: 'a', jobName: 'Pending Job', jobNumber: 'J1', color: '#3b82f6', startKey: '2026-06-01', endKey: '2026-06-01', isLocked: false, startTime: '08:00', endTime: '17:00' };
    const lanes: BoardLane[] = [{ crewId: 'c', crewName: 'Crew A', cardsByDay: { '2026-06-01': [card] } }];
    const days = [new Date('2026-06-01T12:00:00')];
    render(<ProductionBoard lanes={lanes} weekDays={days} config={config} canReschedule={false} onDropJob={vi.fn()} pendingIds={new Set(['a'])} />);
    const cardEl = screen.getByText('Pending Job').closest('[title]')!;
    expect(cardEl.className).toContain('border-dashed');
  });

  it('drag ghost matches the dragged card size', () => {
    const card = { jobId: 'a', jobName: 'Wide Job', jobNumber: 'J1', color: '#3b82f6', startKey: '2026-06-01', endKey: '2026-06-03', isLocked: false, startTime: '08:00', endTime: '17:00' };
    const lanes: BoardLane[] = [{ crewId: 'c', crewName: 'Crew A', cardsByDay: {
      '2026-06-01': [card], '2026-06-02': [card], '2026-06-03': [card],
    } }];
    const days = ['2026-06-01','2026-06-02','2026-06-03'].map(k => new Date(`${k}T12:00:00`));
    render(<ProductionBoard lanes={lanes} weekDays={days} config={config} canReschedule={true} onDropJob={vi.fn()} />);
    const cardEl = screen.getByText('Wide Job').closest('[title]')!;
    // jsdom has no layout, so stub the measured size the way a real browser would report it.
    cardEl.getBoundingClientRect = () => ({ width: 360, height: 44, left: 100, top: 50, right: 460, bottom: 94, x: 100, y: 50, toJSON: () => ({}) } as DOMRect);
    document.elementFromPoint = () => null; // jsdom has no layout/hit-testing
    fireEvent.pointerDown(cardEl, { button: 0, clientX: 120, clientY: 60 });
    fireEvent.pointerMove(window, { clientX: 200, clientY: 60 }); // past the 5px threshold
    const ghost = document.querySelector('.fixed.z-\\[60\\]') as HTMLElement;
    expect(ghost).toBeTruthy();
    expect(ghost.style.width).toBe('360px');
    expect(ghost.style.height).toBe('44px');
  });

  it('highlights all connected rows when dragging a job shared across lanes', () => {
    const card = { jobId: 'a', jobName: 'Smith Living Room', jobNumber: 'J1', color: '#22c55e', startKey: '2026-06-01', endKey: '2026-06-01', isLocked: false, startTime: '08:00', endTime: '17:00' };
    const lanes: BoardLane[] = [
      { crewId: 'c1', crewName: 'Alice', cardsByDay: { '2026-06-01': [card] } },
      { crewId: 'c2', crewName: 'Bob', cardsByDay: { '2026-06-01': [card] } },
    ];
    const days = ['2026-06-01', '2026-06-02'].map(k => new Date(`${k}T12:00:00`));
    render(<ProductionBoard lanes={lanes} weekDays={days} config={config} canReschedule={true} onDropJob={vi.fn()} />);
    const cardEl = screen.getAllByText('Smith Living Room')[0].closest('[title]')!;
    cardEl.getBoundingClientRect = () => ({ width: 100, height: 44, left: 0, top: 0, right: 100, bottom: 44, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    // Hover the second day in lane c1; connected lane c2 should also light up that day.
    document.elementFromPoint = () => document.querySelector('[data-cell-id="c1:2026-06-02"]');
    fireEvent.pointerDown(cardEl, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 60, clientY: 10 });
    const c2cell = document.querySelector('[data-cell-id="c2:2026-06-02"]') as HTMLElement;
    expect(c2cell.className).toContain('bg-primary-100');
  });

  it('passes the dragged shift id to onDropJob', () => {
    const onDropJob = vi.fn();
    const card = { jobId: 'job-1', jobName: 'Repaint', jobNumber: 'J1', color: '#06b6d4', startKey: '2026-06-01', endKey: '2026-06-01', isLocked: false, startTime: '08:00', endTime: '12:00', shiftId: 's1', shiftName: 'Prep' };
    const lanes: BoardLane[] = [{ crewId: 'c1', crewName: 'Alice', cardsByDay: { '2026-06-01': [card] } }];
    const days = ['2026-06-01', '2026-06-02', '2026-06-03'].map(k => new Date(`${k}T12:00:00`));
    render(<ProductionBoard lanes={lanes} weekDays={days} config={config} canReschedule onDropJob={onDropJob} />);
    const cardEl = screen.getByText('Repaint').closest('[title]')!;
    cardEl.getBoundingClientRect = () => ({ width: 100, height: 44, left: 0, top: 0, right: 100, bottom: 44, x: 0, y: 0, toJSON: () => ({}) } as DOMRect);
    document.elementFromPoint = () => document.querySelector('[data-cell-id="c1:2026-06-03"]');
    fireEvent.pointerDown(cardEl, { button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(window, { clientX: 60, clientY: 10 }); // past threshold
    fireEvent.pointerUp(window, { clientX: 60, clientY: 10 });
    expect(onDropJob).toHaveBeenCalledWith('job-1', '2026-06-03', 's1');
  });
});
